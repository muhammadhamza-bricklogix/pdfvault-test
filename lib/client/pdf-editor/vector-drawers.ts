import type { Color, PDFFont, PDFPage } from "pdf-lib";
import type { FontCache } from "./font-mapping";

import {
  beginText,
  degrees,
  endText,
  LineCapStyle,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateAndSkewTextDegreesAndTranslate,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  showText,
} from "pdf-lib";

import { logger } from "@/lib/shared/utils/logger";

/**
 * pdf-lib's StandardFonts use WinAnsi encoding and throw an exception
 * the moment they encounter a character outside that range — e.g. `↔`
 * (U+2194), `→`, en-dashes, emoji. The throw propagates all the way up
 * through `mergeFabricEditsIntoPdf` → `persistEditorDocument` and aborts
 * the entire save, including completely unrelated pages.
 *
 * Replace any character the resolved font can't encode with `?`. Losing
 * a single glyph is a smaller harm than losing the whole save, and the
 * fallback only kicks in when the StandardFont path was already taken
 * (real PDF-extracted fonts via fontkit handle Unicode natively, so
 * this is a no-op for them).
 */
function sanitizeTextForFont(font: PDFFont, text: string): string {
  if (!text) return text;
  try {
    font.encodeText(text);

    return text;
  } catch {
    let out = "";

    for (const ch of text) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += "?";
      }
    }

    return out;
  }
}

import { hexToPdfColor } from "./color-utils";
import {
  toPdfDim,
  toPdfX,
  toPdfY,
  type CoordinateContext,
} from "./coordinate-transform";
import {
  fabricPathToSvgString,
  transformPathCoords,
  triangleToSvgPath,
} from "./svg-path-utils";

type FabricObj = Record<string, any>;

// ---------------------------------------------------------------------------
// Origin resolution — Fabric objects can have originX/Y of "left"/"center"/"right"
// We need the true top-left corner for PDF drawing.
// ---------------------------------------------------------------------------

function resolveTopLeft(obj: FabricObj): { left: number; top: number } {
  const left = (obj.left as number) || 0;
  const top = (obj.top as number) || 0;
  const width = ((obj.width as number) || 0) * ((obj.scaleX as number) ?? 1);
  const height = ((obj.height as number) || 0) * ((obj.scaleY as number) ?? 1);
  const originX = (obj.originX as string) || "left";
  const originY = (obj.originY as string) || "top";

  let resolvedLeft = left;
  let resolvedTop = top;

  if (originX === "center") resolvedLeft = left - width / 2;
  else if (originX === "right") resolvedLeft = left - width;

  if (originY === "center") resolvedTop = top - height / 2;
  else if (originY === "bottom") resolvedTop = top - height;

  return { left: resolvedLeft, top: resolvedTop };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Fabric v6/v7 renders a Text/Textbox's line-0 baseline at
 *   `top + fontSize * _fontSizeMult * (1 − _fontSizeFraction)`
 * with the defaults `_fontSizeMult = 1.13` and `_fontSizeFraction = 0.222`
 * (see `node_modules/fabric/dist/src/shapes/Text/constants.min.mjs` +
 * `Text.mjs:520-528, 561-575`). That's `1.13 × 0.778 = 0.87914`.
 *
 * We need to match this at export so any text object — Fabric-native
 * (text tool, annotations, page numbers, signature text) OR modified
 * editModeText (extracted PDF text the user typed / restyled) — lands
 * at the same vertical position in the downloaded PDF that Fabric
 * painted in the composer. pdf-lib's `drawText` places `y` on the
 * baseline, so this constant IS the baseline-from-top offset.
 *
 * Pristine editModeText (`editorType === "editModeText" && pristine`)
 * never reaches this drawer — `merge-pdf.ts:isModifiedEditModeText`
 * filters it out and the source PDF page is copied byte-for-byte, so
 * its baseline stays pdf.js-authoritative. Only user-modified overlays
 * flow through here, and every one of them is painted by Fabric in the
 * composer — matching Fabric's math guarantees composer == download.
 *
 * If Fabric ever changes its defaults, update this constant to match
 * the new values in `constants.min.mjs`.
 */
const FABRIC_BASELINE_MULT = 1.13 * (1 - 0.222); // 0.87914

export async function drawIText(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
  fontCache: FontCache,
): Promise<void> {
  const editorTypeEarly = (obj.editorType as string) || "";
  let rawText = obj.text as string | undefined;

  if (!rawText) return;

  if (editorTypeEarly === "editModeText") {
    logger.debug("[PDFedits] drawIText: editModeText drawing", {
      text: rawText.slice(0, 30),
      textLen: rawText.length,
      pristine: (obj as { pristine?: boolean }).pristine,
      originalText:
        typeof (obj as { originalText?: string }).originalText === "string"
          ? (obj as { originalText?: string }).originalText!.slice(0, 30)
          : null,
      left: obj.left,
      top: obj.top,
      originalLeft: (obj as { originalLeft?: number }).originalLeft,
      originalTop: (obj as { originalTop?: number }).originalTop,
    });
  }

  // editModeText overlays mirror pdf.js's extracted text runs, which often
  // carry a trailing space (pdf.js exposes word breaks via the `str` field
  // of each TextItem). Inter-word spacing in PDFs is normally produced by
  // explicit advance operators, not by drawing a space glyph — so embedded
  // SUBSET fonts often omit the space glyph entirely. `drawText`-ing that
  // trailing space then renders as the font's `.notdef` glyph (a small
  // box `□`), producing the "trailing-box after every word" symptom
  // reported 2026-06-17. Strip trailing whitespace for editModeText only;
  // positions on the source page already encode the spacing.
  if (editorTypeEarly === "editModeText") {
    rawText = rawText.replace(/\s+$/, "");
    if (!rawText) return;
  }

  const fontFamily = (obj.fontFamily as string) || "Helvetica";
  const fontWeight = (obj.fontWeight as string) || "normal";
  const fontStyle = (obj.fontStyle as string) || "normal";
  const objScaleX = (obj.scaleX as number) ?? 1;
  const objScaleY = (obj.scaleY as number) ?? 1;
  const baseFontSize = (obj.fontSize as number) || 16;
  const fontSize = baseFontSize * objScaleY;
  const opacity = (obj.opacity as number) ?? 1;
  const angle = (obj.angle as number) || 0;

  // The object's bounding box width in Fabric units (what the user sees as the text container)
  const objWidth = ((obj.width as number) || 0) * objScaleX;
  const editorType = editorTypeEarly;

  const { left, top } = resolveTopLeft(obj);

  let font = await fontCache.getFont(fontFamily, fontWeight, fontStyle);

  // For editModeText where the user CHANGED the text (text !==
  // originalText), the new characters they typed are very likely NOT in
  // the source PDF's subset font — typing "test" into a word that
  // didn't contain `t/e/s` means those glyphs simply aren't embedded.
  // pdf-lib's `encodeText` silently maps unknown codepoints to the
  // `.notdef` glyph (it doesn't throw), so a try/catch can't detect
  // the miss — the saved PDF renders the missing chars as `?` boxes
  // (QA report 2026-06-17: "I added 4 characters and the version
  // preview shows 4 ????").
  //
  // Fix: detect the text-change case and switch the WHOLE string to
  // the StandardFont equivalent (Helvetica / Times / Courier per the
  // family). StandardFonts are full WinAnsi so they cover ASCII +
  // common Latin reliably. Trade-off is a tiny font-metric drift from
  // the surrounding source text — far better than `????`. Unmodified
  // text (text === originalText, just moved/resized) keeps the
  // embedded font because every glyph it needs is guaranteed to be
  // in the subset.
  if (editorTypeEarly === "editModeText") {
    const originalText = (obj as { originalText?: string }).originalText;

    if (typeof originalText === "string" && rawText !== originalText) {
      font = await fontCache.getStandardFallback(
        fontFamily,
        fontWeight,
        fontStyle,
      );
    }
  }

  // Pre-sanitize against the resolved font so every downstream
  // `font.encodeText` / `font.widthOfTextAtSize` / `page.drawText` call
  // sees only characters that font can represent.
  const text = sanitizeTextForFont(font, rawText);
  const color = hexToPdfColor(obj.fill as string) ?? rgb(0, 0, 0);

  const pdfFontSize = toPdfDim(fontSize, ctx.scaleY);

  // For extracted PDF text items, skip maxWidth — their position is controlled
  // by precise x/y coordinates, not text wrapping. maxWidth would cause pdf-lib
  // to compress text when its font metrics differ from the original PDF's.
  const pdfMaxWidth =
    editorType === "editModeText"
      ? undefined
      : objWidth > 0
        ? toPdfDim(objWidth, ctx.scaleX)
        : undefined;

  // QA 2026-09-09: baseline distance from `top`, in Fabric units. The
  // old formula (`fontHeight = font.heightAtSize(size, {descender:false})`
  // ≈ 0.718 × fontSize for Helvetica) under-shot the true composer
  // baseline by `(0.87914 − 0.718) × fontSize ≈ 0.161 × fontSize`. At
  // small sizes (12-16 pt) this was 2-3 pt — no one noticed. At 96 pt
  // Bold+Italic it drifted ~15.5 pt upward on the download vs. the
  // composer (QA report). Fabric's own baseline math (see the
  // `FABRIC_BASELINE_MULT` block above) is used for ALL text overlays
  // that reach this drawer — Fabric-native (text tool, annotations,
  // page numbers, signature text) AND modified editModeText — because
  // every one of them is painted by Fabric in the composer.
  //
  // Pristine editModeText never reaches this drawer (filtered out
  // upstream in `merge-pdf.ts`), so its pdf.js-authoritative baseline
  // is preserved via the byte-for-byte page copy path.
  //
  // Rotated text (angle 90/180/270) below uses the same value along the
  // rotated axis; the branch structure stays as-is.
  const ascendFabric = fontSize * FABRIC_BASELINE_MULT;
  let fabricBaselineX = left;
  let fabricBaselineY = top + ascendFabric;

  if (angle === 90) {
    fabricBaselineX = left + ascendFabric;
    fabricBaselineY = top;
  } else if (angle === 180) {
    fabricBaselineX = left;
    fabricBaselineY = top - ascendFabric;
  } else if (angle === 270) {
    fabricBaselineX = left - ascendFabric;
    fabricBaselineY = top;
  }

  const pdfX = toPdfX(fabricBaselineX, ctx);
  const pdfY = ctx.pdfHeight - toPdfDim(fabricBaselineY, ctx.scaleY);

  // Unit advance vector in PDF coords for the text-flow direction.
  // For Fabric angle R (CW in screen), PDF math rotation is -R.
  //   angle 0   → ( 1,  0)
  //   angle 90  → ( 0, -1)
  //   angle 180 → (-1,  0)
  //   angle 270 → ( 0,  1)
  const angleRad = (-angle * Math.PI) / 180;
  const advanceX = Math.cos(angleRad);
  const advanceY = Math.sin(angleRad);
  // Next-line offset is the advance vector rotated −90° (lines flow below the
  // current one in screen terms). 0: (0,-1); 90: (-1,0); 180: (0,1); 270: (1,0).
  const nextLineX = advanceY;
  const nextLineY = -advanceX;

  // Use Fabric's obj.width as the target — it's what the user sees on screen.
  // This correctly reflects both unedited text AND user edits (added/removed words).
  const fabricObjWidth = toPdfDim(objWidth, ctx.scaleX);
  const targetWidth = fabricObjWidth;

  // Textbox stores wrapped lines on `_textLines` (each entry is a grapheme
  // array). `text` is the unwrapped string with hard \n only — splitting
  // on \n alone collapses visually-wrapped Textbox content to one line in
  // the saved PDF (overflowing the original bbox). Prefer the wrapped
  // representation when present; fall back to the \n split for IText
  // (annotations, page numbers, watermark, text tool) so their behaviour
  // is unchanged.
  //
  // Two sources for wrapped lines:
  //   1. `wrappedTextLines` — a plain string[] injected by
  //      `serializeFabricCanvas` at save time by reading the live
  //      Textbox's `_textLines`. Survives the JSON round-trip and is
  //      the reliable path for the merge pipeline reading
  //      `fabricJsonByPage[page]`.
  //   2. `_textLines` — Fabric's private cached field. Only present
  //      when the object is a live Fabric Textbox instance (i.e.,
  //      when the drawer is called with an object that came directly
  //      from the live canvas rather than via a JSON round-trip).
  //      Kept as a fallback so live-canvas paths still work.
  const wrapped = obj as {
    _textLines?: ReadonlyArray<ReadonlyArray<string> | string>;
    wrappedTextLines?: ReadonlyArray<string>;
  };
  const persistedLines: string[] | undefined = Array.isArray(
    wrapped.wrappedTextLines,
  )
    ? wrapped.wrappedTextLines.map((l) => String(l))
    : undefined;
  const cachedLines: string[] | undefined = Array.isArray(wrapped._textLines)
    ? wrapped._textLines.map((l) => (Array.isArray(l) ? l.join("") : String(l)))
    : undefined;
  const visualLines = persistedLines ?? cachedLines;
  const lines =
    visualLines && visualLines.length > 0 ? visualLines : text.split("\n");
  const lineHeight = (obj.lineHeight as number) ?? 1.16;
  const pdfLineHeight = pdfFontSize * lineHeight;

  // For extracted PDF text, split by spaces and position each word individually.
  // pdf.js font subsets often omit the space glyph (PDF uses positioning operators
  // instead of space characters), so rendering the full string collapses spaces to
  // zero width. Instead, we measure each word with fontkit, compute the leftover
  // width (fabricWidth - totalWordWidth) and distribute it evenly as inter-word gaps.
  //
  // BUT only for PRISTINE editModeText (text === originalText). Once the user
  // has typed a replacement, the new string has no relationship to the source
  // PDF's advance-operator spacing — distributing across `targetWidth` (which
  // is still the ORIGINAL fragment width) stretches the shorter modified text
  // and produces obviously wrong gaps: e.g., "1st edit" spread across 240 pt
  // shows as "1st        edit" in the downloaded PDF (QA 2026-09-08). Modified
  // editModeText already uses StandardFonts (via `getStandardFallback`),
  // which are WinAnsi and DO include the space glyph, so plain `drawText`
  // renders spacing correctly. Fall through to the ELSE branch below.
  const isPristineEditModeText =
    editorType === "editModeText" &&
    (obj as { pristine?: boolean }).pristine === true;

  if (isPristineEditModeText && targetWidth > 0) {
    const fontKey = page.node.newFontDictionary(font.name, font.ref);

    // Text matrix factory: identity rotation for angle 0, rotation matrix
    // otherwise. PDF rotations are CCW-positive while Fabric angle is
    // CW-positive in screen, so we pass -angle.
    const textMatrixAt = (x: number, y: number) =>
      angle === 0
        ? setTextMatrix(1, 0, 0, 1, x, y)
        : rotateAndSkewTextDegreesAndTranslate(-angle, 0, 0, x, y);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      // Per-line baseline: advance from (pdfX, pdfY) along the next-line
      // direction. For angle 0 this collapses to pdfY - i * pdfLineHeight.
      const lineX = pdfX + i * pdfLineHeight * nextLineX;
      const lineY = pdfY + i * pdfLineHeight * nextLineY;
      // Split on ANY whitespace (NBSP U+00A0, thin space U+2009, tab, etc.) —
      // not just U+0020. Typographic PDFs frequently use NBSP between words,
      // and the embedded subset font often lacks the NBSP glyph, so leaving it
      // in the encoded string renders as a .notdef "tofu" box on every space.
      const words = line.split(/\s/);

      if (words.length <= 1) {
        // Single word — no space issue, draw directly
        page.pushOperators(
          pushGraphicsState(),
          beginText(),
          setFillingColor(color),
          setFontAndSize(fontKey, pdfFontSize),
          textMatrixAt(lineX, lineY),
          showText(font.encodeText(line)),
          endText(),
          popGraphicsState(),
        );
      } else {
        // Multiple words — measure each, distribute remaining width as spaces.
        // Filter out empty strings from split (leading/trailing spaces produce
        // them) to avoid inflating the space count. Trailing space in the
        // original text is positional padding between PDF fragments — it must
        // NOT be redistributed among visible word gaps.
        const nonEmptyWords = words.filter((w) => w.length > 0);

        if (nonEmptyWords.length <= 1) {
          // After filtering, only one word — draw directly
          const singleWord = nonEmptyWords[0] || line;

          page.pushOperators(
            pushGraphicsState(),
            beginText(),
            setFillingColor(color),
            setFontAndSize(fontKey, pdfFontSize),
            textMatrixAt(lineX, lineY),
            showText(font.encodeText(singleWord)),
            endText(),
            popGraphicsState(),
          );
        } else {
          const wordWidths = nonEmptyWords.map((w) =>
            font.widthOfTextAtSize(w, pdfFontSize),
          );
          const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);

          // Count leading spaces to offset the cursor start
          let leadingSpaces = 0;

          for (let s = 0; s < words.length; s++) {
            if (words[s] === "") leadingSpaces++;
            else break;
          }

          // Estimate width of one space from the original text metrics:
          // total spaces in text = words.length - 1 (from split)
          // internal gaps = nonEmptyWords.length - 1
          const totalSpaces = words.length - 1;
          // Total space to fill = fabricWidth - word widths
          const totalSpaceWidth = targetWidth - totalWordWidth;

          // Distribute space width only among ALL original spaces (including
          // leading/trailing) to compute per-space width, then use that for
          // internal gaps. Leading/trailing spaces just offset the cursor.
          const perSpaceWidth =
            totalSpaces > 0 ? Math.max(0, totalSpaceWidth / totalSpaces) : 0;

          // 2D cursor — advances along the text-flow direction.
          const startOffset = leadingSpaces * perSpaceWidth;
          let cursorX = lineX + startOffset * advanceX;
          let cursorY = lineY + startOffset * advanceY;

          for (let w = 0; w < nonEmptyWords.length; w++) {
            page.pushOperators(
              pushGraphicsState(),
              beginText(),
              setFillingColor(color),
              setFontAndSize(fontKey, pdfFontSize),
              textMatrixAt(cursorX, cursorY),
              showText(font.encodeText(nonEmptyWords[w])),
              endText(),
              popGraphicsState(),
            );

            // Advance cursor: word width + one space gap (except after last word)
            const step =
              wordWidths[w] +
              (w < nonEmptyWords.length - 1 ? perSpaceWidth : 0);

            cursorX += step * advanceX;
            cursorY += step * advanceY;
          }
        }
      }
    }
  } else {
    // Read the paragraph-level alignment. Fabric's Textbox and IText both
    // store this as `textAlign`. Default (undefined / "left") keeps the
    // pre-existing behavior so unaligned callers (annotations, page
    // numbers, watermarks, plain single-line text) render exactly as
    // before — no regression risk on those paths.
    // QA 2026-09-08: user picks Center or Right in the FloatingTextToolbar,
    // the composer shows the alignment correctly, but the downloaded PDF
    // renders every line at the LEFT edge of the Textbox because pdf-lib's
    // `drawText` doesn't accept a `textAlign` option — we have to
    // compute the per-line x offset ourselves.
    const rawAlign =
      typeof obj.textAlign === "string" ? obj.textAlign : undefined;
    const alignment: "left" | "center" | "right" =
      rawAlign === "center" || rawAlign === "right" ? rawAlign : "left";
    // Alignment offset needs a container width, but `pdfMaxWidth` is
    // deliberately `undefined` for `editModeText` (see the block above:
    // passing a maxWidth to `drawText` makes pdf-lib compress the run
    // when its font metrics differ from the source's — visible baseline
    // drift). Fall back to the Fabric Textbox's own width (`objWidth` in
    // Fabric units → PDF points) so the user's center/right pick still
    // has a box to align WITHIN. QA 2026-09-11: user deletes a long
    // sentence in an editModeText run, types a short word, picks Center
    // — the composer paints Center correctly but the download reverted
    // to left because `boxWidth = 0` short-circuited the per-line offset
    // calculation below.
    const boxWidth =
      typeof pdfMaxWidth === "number" && pdfMaxWidth > 0
        ? pdfMaxWidth
        : editorType === "editModeText" && objWidth > 0
          ? toPdfDim(objWidth, ctx.scaleX)
          : 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue; // skip blank lines (Y still advances via index)

      // Only compute a per-line offset when the caller wants center or
      // right alignment AND we actually know the box width (`maxWidth`).
      // For default left alignment we short-circuit to `offset = 0`, so
      // `x = pdfX` — identical to the old behavior, no chance of
      // pushing left-aligned text off position.
      let offset = 0;

      if (alignment !== "left" && boxWidth > 0) {
        // Measure the rendered width of THIS line in the resolved font +
        // size. `widthOfTextAtSize` can throw for characters the font
        // can't encode; if it does, we fall back to zero offset
        // (left-alignment) so a bad char can't corrupt the render.
        let lineWidth = 0;

        try {
          lineWidth = font.widthOfTextAtSize(line, pdfFontSize);
        } catch {
          lineWidth = 0;
        }

        if (lineWidth > 0 && lineWidth < boxWidth) {
          const slack = boxWidth - lineWidth;

          offset = alignment === "center" ? slack / 2 : slack;
        }
      }

      // Advance the offset along the text-flow direction. For angle 0
      // this collapses to `x = pdfX + offset`, `y` unchanged — the
      // common case and identical to the original layout for
      // left-aligned text (offset = 0). For rotated text the offset
      // rides along `advanceX` / `advanceY` so a rotated line still
      // aligns correctly within the box's rotated frame.
      const drawX = pdfX + offset * advanceX;
      const drawY = pdfY - i * pdfLineHeight + offset * advanceY;

      page.drawText(line, {
        color,
        font,
        maxWidth: pdfMaxWidth,
        opacity,
        rotate: angle ? degrees(-angle) : undefined,
        size: pdfFontSize,
        x: drawX,
        y: drawY,
      });
    }
  }

  // Underline simulation
  if (obj.underline) {
    const underlineOffset = pdfFontSize * 0.1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      const lineWidth = font.widthOfTextAtSize(line, pdfFontSize);
      const lineY = pdfY - i * pdfLineHeight - underlineOffset;

      page.drawLine({
        color,
        end: { x: pdfX + lineWidth, y: lineY },
        opacity,
        start: { x: pdfX, y: lineY },
        thickness: Math.max(0.5, pdfFontSize * 0.05),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rectangle
// ---------------------------------------------------------------------------

export function drawRect(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const width = ((obj.width as number) || 0) * ((obj.scaleX as number) ?? 1);
  const height = ((obj.height as number) || 0) * ((obj.scaleY as number) ?? 1);
  const opacity = (obj.opacity as number) ?? 1;
  const angle = (obj.angle as number) || 0;

  const { left, top } = resolveTopLeft(obj);

  const pdfX = toPdfX(left, ctx);
  const pdfY = toPdfY(top, height, ctx);
  const pdfW = toPdfDim(width, ctx.scaleX);
  const pdfH = toPdfDim(height, ctx.scaleY);

  const editorType = obj.editorType as string | undefined;

  let fillColor: Color | null = null;
  let borderColor: Color | null = null;
  let borderWidth = 0;

  if (editorType === "whiteout") {
    fillColor = rgb(1, 1, 1);
  } else if (editorType === "redaction") {
    // Solid black. The merge pipeline renders the source page with
    // `suppressText: true` and embeds it as a raster, so glyphs underneath
    // this rect are already pixels in the saved bytes — there's no text
    // layer left to leak content. This is a permanent removal, not a cover.
    fillColor = rgb(0, 0, 0);
  } else if (editorType === "highlight") {
    fillColor = hexToPdfColor(obj.fill as string);
  } else {
    fillColor = hexToPdfColor(obj.fill as string);
    // Only carry a stroke through to pdf-lib when the user actually
    // asked for one. pdf-lib's `drawRectangle` treats "borderColor set
    // + borderWidth undefined" as "draw a border, use the default
    // width (1pt)" — so leaving `borderColor` populated while
    // squashing `borderWidth` to undefined produces a visible hairline
    // in the download even though the composer preview showed no
    // stroke (QA 2026-09-08: "stroke thickness 0 in composer, stroke
    // still appears on downloaded PDF"). Save + reload masked the bug
    // because the reload rendered the already-baked bytes and skipped
    // this drawer.
    const rawStrokeWidth = (obj.strokeWidth as number) || 0;

    if (rawStrokeWidth > 0) {
      borderColor = hexToPdfColor(obj.stroke as string);
      borderWidth = toPdfDim(rawStrokeWidth, (ctx.scaleX + ctx.scaleY) / 2);
    }
  }

  page.drawRectangle({
    borderColor: borderColor ?? undefined,
    borderWidth: borderWidth || undefined,
    color: fillColor ?? undefined,
    height: pdfH,
    // Redaction rectangles MUST be fully opaque — a translucent black box
    // wouldn't conceal anything visually under the rasterized page render.
    opacity: editorType === "redaction" ? 1 : opacity,
    rotate: angle ? degrees(-angle) : undefined,
    width: pdfW,
    x: pdfX,
    y: pdfY,
  });
}

// ---------------------------------------------------------------------------
// Ellipse
// ---------------------------------------------------------------------------

export function drawEllipse(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const rx = ((obj.rx as number) || 0) * ((obj.scaleX as number) ?? 1);
  const ry = ((obj.ry as number) || 0) * ((obj.scaleY as number) ?? 1);
  const opacity = (obj.opacity as number) ?? 1;
  const angle = (obj.angle as number) || 0;

  const { left, top } = resolveTopLeft(obj);

  // Ellipse top-left resolved → center = left+rx, top+ry
  const centerX = left + rx;
  const centerY = top + ry;

  const pdfCenterX = toPdfX(centerX, ctx);
  const pdfCenterY = ctx.pdfHeight - toPdfDim(centerY, ctx.scaleY);
  const pdfRx = toPdfDim(rx, ctx.scaleX);
  const pdfRy = toPdfDim(ry, ctx.scaleY);

  const fillColor = hexToPdfColor(obj.fill as string);
  // Same "borderColor without borderWidth defaults to hairline" gotcha
  // as `drawRect` — skip both when the user asked for no stroke. See
  // the long comment in `drawRect` above.
  const rawStrokeWidth = (obj.strokeWidth as number) || 0;
  const borderColor =
    rawStrokeWidth > 0 ? hexToPdfColor(obj.stroke as string) : null;
  const borderWidth =
    rawStrokeWidth > 0
      ? toPdfDim(rawStrokeWidth, (ctx.scaleX + ctx.scaleY) / 2)
      : 0;

  page.drawEllipse({
    borderColor: borderColor ?? undefined,
    borderWidth: borderWidth || undefined,
    color: fillColor ?? undefined,
    opacity,
    rotate: angle ? degrees(-angle) : undefined,
    x: pdfCenterX,
    xScale: pdfRx,
    y: pdfCenterY,
    yScale: pdfRy,
  });
}

// ---------------------------------------------------------------------------
// Line
// ---------------------------------------------------------------------------

export function drawLine(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const x1 = (obj.x1 as number) || 0;
  const y1 = (obj.y1 as number) || 0;
  const x2 = (obj.x2 as number) || 0;
  const y2 = (obj.y2 as number) || 0;
  const scaleX = (obj.scaleX as number) ?? 1;
  const scaleY = (obj.scaleY as number) ?? 1;
  const opacity = (obj.opacity as number) ?? 1;

  const { left, top } = resolveTopLeft(obj);

  // Fabric Line stores x1,y1,x2,y2 relative to the object center.
  // The object's left,top positions the bounding box top-left.
  // The actual endpoints in canvas space:
  const startX = left + (x1 - Math.min(x1, x2)) * scaleX;
  const startY = top + (y1 - Math.min(y1, y2)) * scaleY;
  const endX = left + (x2 - Math.min(x1, x2)) * scaleX;
  const endY = top + (y2 - Math.min(y1, y2)) * scaleY;

  const color = hexToPdfColor(obj.stroke as string);
  const thickness = toPdfDim(
    (obj.strokeWidth as number) || 1,
    (ctx.scaleX + ctx.scaleY) / 2,
  );

  page.drawLine({
    color: color ?? rgb(0, 0, 0),
    end: {
      x: toPdfX(endX, ctx),
      y: ctx.pdfHeight - toPdfDim(endY, ctx.scaleY),
    },
    lineCap: LineCapStyle.Round,
    opacity,
    start: {
      x: toPdfX(startX, ctx),
      y: ctx.pdfHeight - toPdfDim(startY, ctx.scaleY),
    },
    thickness,
  });
}

// ---------------------------------------------------------------------------
// Path (freehand drawing)
// ---------------------------------------------------------------------------

export function drawPath(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const pathArray = obj.path as (number | string)[][] | undefined;

  if (!pathArray?.length) return;

  const scaleX = (obj.scaleX as number) ?? 1;
  const scaleY = (obj.scaleY as number) ?? 1;
  const opacity = (obj.opacity as number) ?? 1;

  // Fabric v6 Path coordinate model (verified against runtime logs
  // 2026-08-20 for PencilBrush highlights, all 3 paths):
  //   - `obj.path` holds path commands with coords in RAW CANVAS
  //     SPACE, i.e. the absolute pointer positions when the user
  //     drew each point. NOT normalised to bbox-local (0..width).
  //   - `obj.width`, `obj.height` = raw bbox size.
  //   - `obj.scaleX/Y` = user-applied scale (1 by default).
  //   - **`obj.left`, `obj.top` = CENTER of the bbox in canvas coords
  //     (NOT the top-left)** — Fabric v6 Path uses center-origin
  //     positioning internally, even though `originX/Y` may not
  //     appear as `"center"` in the serialized JSON. Verified
  //     empirically: for every fresh path,
  //     `obj.left === bbox.minX + width/2` (± sub-pixel stroke pad).
  //   - `obj.pathOffset` = the same bbox center in raw path coords.
  //     Fabric v6's `toJSON()` does NOT serialize it — reading it
  //     from a JSON.parse'd snapshot yields `undefined`.
  //
  // Four earlier attempts got this wrong:
  //   1. `+ pathOffset * scale` on both pdfX and pdfY (QA 2026-08-20 a).
  //   2. Position by `left/top` while SVG path also carried those
  //      coords — double offset, off the right edge (QA 2026-08-20 b).
  //   3. Delta via `left - (pathOffset - width/2)` — pathOffset missing
  //      from JSON → delta = left + width/2 (QA 2026-08-20 c).
  //   4. Walked path data for `originalMinX`, but computed
  //      `delta = objLeft - originalMinX` treating objLeft as bbox
  //      TOP-LEFT. That's `width/2` too far right — path drifted
  //      toward center of page (QA 2026-08-20 d, visible in
  //      screenshot 23: all three highlights collapsed to center-top).
  //
  // Correct model:
  //   - Walk the path data to find `originalMinX/Y` (raw bbox top-left).
  //   - Convert `obj.left/top` from center to top-left by subtracting
  //     `scaledWidth/2` and `scaledHeight/2`.
  //   - `delta = currentTopLeft - originalMinX/Y * scaleX/Y`.
  //   - Draw SVG at `(delta.x * ctx.scaleX, pdfHeight - delta.y * ctx.scaleY)`.
  //
  // For a freshly-drawn unmoved unscaled path, delta ≈ 0 (up to
  // sub-pixel stroke padding), so SVG lands at `(0, pdfHeight)`
  // and its raw coords render at their original canvas positions
  // in PDF space (Y-flipped inside `transformPathCoords`).
  const objLeft = (obj.left as number) || 0;
  const objTop = (obj.top as number) || 0;
  const rawWidth = (obj.width as number) || 0;
  const rawHeight = (obj.height as number) || 0;
  const scaledWidth = rawWidth * scaleX;
  const scaledHeight = rawHeight * scaleY;

  // Walk the raw path data to find its actual bbox top-left (in the
  // path coord space, before any translation or scale).
  let originalMinX = Number.POSITIVE_INFINITY;
  let originalMinY = Number.POSITIVE_INFINITY;

  for (const cmd of pathArray) {
    if (typeof cmd[0] !== "string") continue;
    const letter = cmd[0];

    if (letter === "Z" || letter === "z") continue;

    // Coord pairs after the command letter. Fabric-emitted commands
    // are all absolute uppercase — M/L/T = 1 pt; Q/S = 2 pts; C = 3 pts.
    // Arc (A) mixes flags/radii into the arg list but PencilBrush
    // doesn't emit A, so pair-walking is safe here.
    for (let i = 1; i < cmd.length; i += 2) {
      const x = cmd[i];
      const y = cmd[i + 1];

      if (typeof x === "number" && x < originalMinX) originalMinX = x;
      if (typeof y === "number" && y < originalMinY) originalMinY = y;
    }
  }

  if (!Number.isFinite(originalMinX)) originalMinX = 0;
  if (!Number.isFinite(originalMinY)) originalMinY = 0;

  // Convert obj.left/top (bbox CENTER in canvas coords) → bbox TOP-LEFT.
  const bboxLeft = objLeft - scaledWidth / 2;
  const bboxTop = objTop - scaledHeight / 2;

  // Movement delta from the original bbox top-left (in raw path coords,
  // scaled by obj scale) to the current bbox top-left. Zero for a
  // freshly-drawn unmoved path (up to sub-pixel stroke padding).
  const deltaX = bboxLeft - originalMinX * scaleX;
  const deltaY = bboxTop - originalMinY * scaleY;

  const totalScaleX = scaleX * ctx.scaleX;
  const totalScaleY = scaleY * ctx.scaleY;

  const transformed = transformPathCoords(pathArray, totalScaleX, -totalScaleY);
  const svgPath = fabricPathToSvgString(transformed);

  const pdfX = toPdfDim(deltaX, ctx.scaleX);
  const pdfY = ctx.pdfHeight - toPdfDim(deltaY, ctx.scaleY);

  const strokeColor = hexToPdfColor(obj.stroke as string);
  const fillColor = hexToPdfColor(obj.fill as string);
  const borderWidth = toPdfDim(
    (obj.strokeWidth as number) || 1,
    (ctx.scaleX + ctx.scaleY) / 2,
  );

  // EXPORT-DIAG: exhaustive dump of what actually reaches pdf-lib for this
  // Path. If the exported PDF "loses" the highlight, one of these will
  // reveal why: pdfY≈pdfHeight (drawn at top), opacity≈0, stroke missing,
  // borderWidth≈0, or svgPath truncated. Truncate the svgPath preview so
  // the log stays readable for long freehand strokes.
  try {
    const svgPreview =
      svgPath.length > 200
        ? `${svgPath.slice(0, 200)}…(${svgPath.length}ch)`
        : svgPath;

    // eslint-disable-next-line no-console
    console.log("[PDFedits] EXPORT-DIAG: drawPath →", {
      editorType: (obj as { editorType?: string }).editorType,
      objLeft,
      objTop,
      rawWidth,
      rawHeight,
      scaledWidth,
      scaledHeight,
      bboxLeft,
      bboxTop,
      originalMinX,
      originalMinY,
      deltaX,
      deltaY,
      objScaleX: scaleX,
      objScaleY: scaleY,
      totalScaleX,
      totalScaleY,
      pdfHeight: ctx.pdfHeight,
      pdfX,
      pdfY,
      strokeRaw: obj.stroke,
      strokeParsed: strokeColor,
      fillRaw: obj.fill,
      fillParsed: fillColor,
      opacity,
      strokeWidthRaw: obj.strokeWidth,
      borderWidth,
      pathCmdCount: pathArray.length,
      svgPreview,
    });
  } catch {
    /* diagnostic-only, never block the actual draw */
  }

  page.drawSvgPath(svgPath, {
    borderColor: strokeColor ?? rgb(0, 0, 0),
    borderLineCap: LineCapStyle.Round,
    borderWidth: borderWidth,
    color: fillColor ?? undefined,
    opacity,
    x: pdfX,
    y: pdfY,
  });
}

// ---------------------------------------------------------------------------
// Triangle (standalone or arrowhead)
// ---------------------------------------------------------------------------

export function drawTriangle(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const width = ((obj.width as number) || 0) * ((obj.scaleX as number) ?? 1);
  const height = ((obj.height as number) || 0) * ((obj.scaleY as number) ?? 1);
  const angle = (obj.angle as number) || 0;
  const opacity = (obj.opacity as number) ?? 1;

  // Triangle uses originX/Y "center" — resolveTopLeft gives us top-left,
  // but drawSvgPath for triangle is centered at (0,0), so we need center.
  const originX = (obj.originX as string) || "left";
  const originY = (obj.originY as string) || "top";
  const rawLeft = (obj.left as number) || 0;
  const rawTop = (obj.top as number) || 0;

  let centerX = rawLeft;
  let centerY = rawTop;

  if (originX === "left") centerX = rawLeft + width / 2;
  else if (originX === "right") centerX = rawLeft - width / 2;

  if (originY === "top") centerY = rawTop + height / 2;
  else if (originY === "bottom") centerY = rawTop - height / 2;

  const svgPath = triangleToSvgPath(
    toPdfDim(width, ctx.scaleX),
    toPdfDim(height, ctx.scaleY),
  );

  const pdfX = toPdfX(centerX, ctx);
  const pdfY = ctx.pdfHeight - toPdfDim(centerY, ctx.scaleY);

  const fillColor = hexToPdfColor(obj.fill as string);
  // Same "borderColor without borderWidth defaults to hairline" gotcha
  // as `drawRect` — skip both when the user asked for no stroke. See
  // the long comment in `drawRect` above.
  const rawStrokeWidth = (obj.strokeWidth as number) || 0;
  const borderColor =
    rawStrokeWidth > 0 ? hexToPdfColor(obj.stroke as string) : null;
  const borderWidth =
    rawStrokeWidth > 0
      ? toPdfDim(rawStrokeWidth, (ctx.scaleX + ctx.scaleY) / 2)
      : 0;

  page.drawSvgPath(svgPath, {
    borderColor: borderColor ?? undefined,
    borderWidth: borderWidth || undefined,
    color: fillColor ?? undefined,
    opacity,
    rotate: angle ? degrees(-angle) : undefined,
    x: pdfX,
    y: pdfY,
  });
}

// ---------------------------------------------------------------------------
// Group (arrows: Line + Triangle composite)
// ---------------------------------------------------------------------------

export async function drawGroup(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
  fontCache: FontCache,
): Promise<boolean> {
  const children = obj.objects as FabricObj[] | undefined;

  if (!children?.length) return false;

  // The group's left/top positions the group bounding box center in Fabric
  const groupLeft = (obj.left as number) || 0;
  const groupTop = (obj.top as number) || 0;
  const groupScaleX = (obj.scaleX as number) ?? 1;
  const groupScaleY = (obj.scaleY as number) ?? 1;

  for (const child of children) {
    const childType = (child.type as string).toLowerCase();

    // Apply group transform: children are positioned relative to group center.
    // Group's left/top is the center of the group in Fabric canvas space.
    // Child's left/top is offset from group center.
    const resolvedChild = {
      ...child,
      left: groupLeft + ((child.left as number) || 0) * groupScaleX,
      scaleX: ((child.scaleX as number) ?? 1) * groupScaleX,
      scaleY: ((child.scaleY as number) ?? 1) * groupScaleY,
      top: groupTop + ((child.top as number) || 0) * groupScaleY,
    };

    switch (childType) {
      case "line":
        drawLine(resolvedChild, page, ctx);
        break;
      case "triangle":
        drawTriangle(resolvedChild, page, ctx);
        break;
      case "rect":
        drawRect(resolvedChild, page, ctx);
        break;
      case "ellipse":
        drawEllipse(resolvedChild, page, ctx);
        break;
      case "i-text":
      case "itext":
      case "text":
      case "textbox":
        await drawIText(resolvedChild, page, ctx, fontCache);
        break;
      case "path":
        drawPath(resolvedChild, page, ctx);
        break;
      default:
        // Unknown child type — signal that this group can't be fully vectorized
        return false;
    }
  }

  return true;
}
