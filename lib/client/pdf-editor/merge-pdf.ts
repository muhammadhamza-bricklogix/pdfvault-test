import type { PDFDocument, PDFPage } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { CoordinateContext } from "./coordinate-transform";
import type { ParsedFabricJson } from "./save-utils";
import type { FontData } from "./text-extraction";
import type {
  BackgroundImageConfig,
  BackgroundImageFit,
  WatermarkConfig,
} from "@/lib/client/stores/pdf-editor-store";

import { createCoordinateContext } from "./coordinate-transform";
import { FontCache } from "./font-mapping";
import {
  dataUrlToBytes,
  parseFabricJson,
  renderFabricSubsetToPng,
} from "./save-utils";
import {
  drawEllipse,
  drawGroup,
  drawIText,
  drawLine,
  drawRect,
  drawTriangle,
} from "./vector-drawers";
import {
  drawWatermarkOnPage,
  resetWatermarkFontCache,
} from "./watermark-drawer";
import { shouldWatermarkPage } from "./watermark-utils";

type FabricObj = Record<string, any>;

export type MergePdfInput = {
  /** Map of display slot (1-indexed) → Fabric canvas JSON. */
  fabricJsonByPage: Map<number, string>;
  /** Font data extracted from pdf.js for custom font embedding. */
  fontDataMap: Map<string, FontData>;
  /** Display order: each entry is a 1-indexed source PDF page number. */
  pageOrder: number[];
  /** The pdf.js document proxy — needed to render pages for raster backgrounds. */
  pdfDocument: PDFDocumentProxy;
  /** Original PDF bytes. */
  sourceBytes: ArrayBuffer;
  /** Watermark configuration — null means no watermark. */
  watermarkConfig?: WatermarkConfig | null;
  /** Background image configuration — null means no background image. */
  backgroundImageConfig?: BackgroundImageConfig | null;
};

// pdf.js OPS constants for text rendering operations (31–49)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

// Background raster scale — 3× for high quality output
const RASTER_SCALE = 3;

// ---------------------------------------------------------------------------
// Object classification
// ---------------------------------------------------------------------------

const VECTOR_TYPES = new Set([
  "ellipse",
  "group",
  "i-text",
  "itext",
  "line",
  "rect",
  "text",
  "textbox",
  "triangle",
]);
// "path" and "image" go through raster (PNG at multiplier:3)

function isVectorizable(obj: FabricObj): boolean {
  // Annotation glyphs (✓ ✗ → ★ ⚑ ¶ etc.) live in IText objects with
  // `editorType: "annotation"`. Annotations + editModeText both
  // contain arbitrary user / source-PDF unicode. pdf-lib's `drawText`
  // uses StandardFonts (WinAnsi-encoded only) and silently replaces
  // unencodable glyphs with "?" via `sanitizeTextForFont`.
  // Forcing them through the raster batch path renders each via the
  // browser's canvas (full Unicode), preserving every glyph as a
  // PNG. editModeText is routed here only on pages where we're
  // already rasterizing — Case 3 strips it from the object list on
  // copyPages-style pages (no rasterization, source text intact).
  const editorType = (obj as { editorType?: string }).editorType;

  if (editorType === "annotation" || editorType === "editModeText") {
    return false;
  }

  return VECTOR_TYPES.has((obj.type as string).toLowerCase());
}

// ---------------------------------------------------------------------------
// Render a pdf.js page to PNG (text-suppressed) for use as raster background
// ---------------------------------------------------------------------------

type RenderPageOptions = {
  /** Suppress pdf.js text rendering ops (default true for legacy callers). */
  suppressText?: boolean;
  /** Render against a transparent background (default false). */
  transparent?: boolean;
};

async function renderPageToPng(
  page: PDFPageProxy,
  options: RenderPageOptions = {},
): Promise<Uint8Array> {
  const { suppressText = true, transparent = false } = options;
  const viewport = page.getViewport({ scale: RASTER_SCALE });

  const canvas = document.createElement("canvas");

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "-9999px";
  document.body.appendChild(canvas);

  try {
    let operationsFilter: ((i: number) => boolean) | undefined;

    if (suppressText) {
      const opList = await page.getOperatorList();
      const textIndices = new Set<number>();

      for (let i = 0; i < opList.fnArray.length; i++) {
        const op = opList.fnArray[i];

        if (op >= TEXT_OPS_MIN && op <= TEXT_OPS_MAX) {
          textIndices.add(i);
        }
      }
      operationsFilter = (i: number) => !textIndices.has(i);
    }

    await page.render({
      ...(transparent ? { background: "rgba(0,0,0,0)" } : {}),
      canvas,
      ...(operationsFilter ? { operationsFilter } : {}),
      viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        "image/png",
      );
    });

    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    if (document.body.contains(canvas)) {
      document.body.removeChild(canvas);
    }
  }
}

// ---------------------------------------------------------------------------
// Background image — centered rect from user-supplied W/H (PDF points)
// ---------------------------------------------------------------------------

function computeBackgroundImageRect(
  imageWidth: number,
  imageHeight: number,
  pageWidth: number,
  pageHeight: number,
  fit: BackgroundImageFit,
): { height: number; width: number; x: number; y: number } {
  if (fit === "stretch" || imageWidth <= 0 || imageHeight <= 0) {
    return { height: pageHeight, width: pageWidth, x: 0, y: 0 };
  }

  const scaleX = pageWidth / imageWidth;
  const scaleY = pageHeight / imageHeight;
  const scale =
    fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    height,
    width,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
}

async function embedBackgroundImage(pdfDoc: PDFDocument, dataUrl: string) {
  const bytes = dataUrlToBytes(dataUrl);

  return dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
    ? pdfDoc.embedJpg(bytes)
    : pdfDoc.embedPng(bytes);
}

// ---------------------------------------------------------------------------
// Raster batch flush — renders a subset of objects to PNG and draws on page
// ---------------------------------------------------------------------------

async function flushRasterBatch(
  indices: number[],
  parsed: ParsedFabricJson,
  page: PDFPage,
  pdfDoc: PDFDocument,
): Promise<void> {
  if (!indices.length) return;

  const pngDataUrl = await renderFabricSubsetToPng(parsed, indices);

  if (!pngDataUrl) return;

  const pngBytes = dataUrlToBytes(pngDataUrl);
  const pngImage = await pdfDoc.embedPng(pngBytes);
  const { height, width } = page.getSize();

  page.drawImage(pngImage, { height, width, x: 0, y: 0 });
}

// ---------------------------------------------------------------------------
// Draw a single vectorizable object
// ---------------------------------------------------------------------------

async function drawVectorObject(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
  fontCache: FontCache,
): Promise<boolean> {
  const type = (obj.type as string).toLowerCase();

  switch (type) {
    case "i-text":
    case "itext":
    case "text":
    case "textbox":
      await drawIText(obj, page, ctx, fontCache);

      return true;

    case "rect":
      drawRect(obj, page, ctx);

      return true;

    case "ellipse":
      drawEllipse(obj, page, ctx);

      return true;

    case "line":
      drawLine(obj, page, ctx);

      return true;

    case "triangle":
      drawTriangle(obj, page, ctx);

      return true;

    case "group":
      return drawGroup(obj, page, ctx, fontCache);

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Process all objects on a page in z-order (hybrid vector + raster)
// ---------------------------------------------------------------------------

async function processPageObjects(
  objects: FabricObj[],
  parsed: ParsedFabricJson,
  page: PDFPage,
  pdfDoc: PDFDocument,
  ctx: CoordinateContext,
  fontCache: FontCache,
): Promise<void> {
  let rasterBatch: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];

    if (isVectorizable(obj)) {
      // Flush any accumulated raster objects first (preserves z-order)
      if (rasterBatch.length) {
        await flushRasterBatch(rasterBatch, parsed, page, pdfDoc);
        rasterBatch = [];
      }

      const drawn = await drawVectorObject(obj, page, ctx, fontCache);

      // If the vector drawer couldn't handle it (e.g. unknown group children),
      // fall back to raster for this specific object
      if (!drawn) {
        rasterBatch.push(i);
      }
    } else {
      // Rasterizable object (image, or unknown type)
      rasterBatch.push(i);
    }
  }

  // Flush remaining raster objects
  if (rasterBatch.length) {
    await flushRasterBatch(rasterBatch, parsed, page, pdfDoc);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a new PDF from the source by:
 *
 * - **Unedited pages**: copied as-is from the source PDF (zero quality loss).
 * - **Edited pages**: the original page is rendered to a high-res PNG (with
 *   text suppressed) as a raster background, then all Fabric objects are drawn
 *   on top using real embedded fonts extracted from pdf.js.
 *
 * This eliminates text duplication (original text is rasterized into the
 * background, Fabric text objects become the sole vector text layer) and
 * preserves original font fidelity.
 */
export async function mergeFabricEditsIntoPdf({
  fabricJsonByPage,
  fontDataMap,
  pageOrder: _pageOrder,
  pdfDocument,
  sourceBytes,
  watermarkConfig,
  backgroundImageConfig,
}: MergePdfInput): Promise<Uint8Array> {
  const { PDFDocument: PdfDoc } = await import("pdf-lib");

  // Load source for copying unedited pages.
  // ignoreEncryption: permission-flagged PDFs (no password) otherwise throw.
  const sourcePdf = await PdfDoc.load(sourceBytes, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();

  // Create a fresh output document
  const outputPdf = await PdfDoc.create();
  const fontCache = new FontCache(outputPdf, fontDataMap);

  // Reset watermark font cache for fresh export
  resetWatermarkFontCache();

  const wm = watermarkConfig?.enabled ? watermarkConfig : null;
  const bg =
    backgroundImageConfig?.enabled && backgroundImageConfig.imageData
      ? backgroundImageConfig
      : null;

  // Embed the background image ONCE up front and reuse the same PDFImage on
  // every matching page. Without this, a 200-page export with a 1 MB image
  // ships ~200 MB of embedded bytes in the output PDF.
  const bgImageOnce = bg
    ? await embedBackgroundImage(outputPdf, bg.imageData!)
    : null;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const hasEdits = fabricJsonByPage.has(pageNum);
    // Promote "page only has auto-extracted source-text IText" to "no
    // edits" so Case 1/2 copy the source page as-is and preserve real
    // PDF text objects.
    //
    // Why: `useEditTextMode` mirrors the source PDF's text content as
    // Fabric IText (`editorType === "editModeText"`) so users can
    // click-to-edit. Those overlays end up in `fabricJsonByPage` even
    // when the user never touched them. Without this guard, every
    // page with extractable text takes Case 3 (rasterize page to PNG,
    // draw Fabric objects on top) — which makes the exported /
    // shared / extract-images output image-only with zero selectable
    // text. Bug surfaced 2026-06-15: user reported (a) blank text on
    // PDF export, (b) "zoomed page rasters" from extract-images
    // (Poppler's `pdfimages -all` was picking up the page PNGs we'd
    // embedded). See skill log 2026-06-15 (c).
    //
    // editModeText carries no information the source PDF doesn't
    // already have, so copying the original page byte-for-byte
    // preserves identical text. Genuine user overlays (shapes,
    // image-tool inserts, IText the user added themselves —
    // `editorType !== "editModeText"`) still take Case 3.
    const hasGenuineEdits = hasEdits;

    // Hardcoded `false` (2026-06-17). Source text is ALWAYS kept in
    // the raster — pdf-lib never touches the source text — so its
    // WinAnsi encoding can never produce □ tofu boxes for non-WinAnsi
    // characters in the source (special spaces, smart quotes, etc.).
    // QA report 2026-06-17: "after save I'm getting empty boxes
    // between my characters."
    //
    // Trade-off (accepted): typing into an existing editModeText
    // IText to modify source text does NOT persist through Save —
    // the editModeText overlay is filtered out before drawing, the
    // raster's original text is what shows up in the output. To
    // actually CHANGE existing text the user has to whiteout the old
    // text and type the replacement via the Text tool (which lands
    // as a non-editModeText IText and draws over the whited-out
    // area). 100% reliable, no boxes.
    //
    // If in-place text modification ever needs to be supported
    // again, the right way is to (a) register `originalText` /
    // `originalLeft` / `originalTop` via `FabricObject.customProperties`
    // so they survive `toJSON()` round-tripping, and (b) re-enable
    // the per-object comparison below. Until then, this stays false.
    const hasModifiedSourceText = false;

    const needsWatermark =
      wm != null &&
      shouldWatermarkPage(
        pageNum,
        totalPages,
        wm.pageScope,
        wm.customPageRange,
      );
    const needsBackground =
      bg != null &&
      shouldWatermarkPage(
        pageNum,
        totalPages,
        bg.pageScope,
        bg.customPageRange,
      );
    const isOverlay = wm?.layer === "overlay";

    // ------------------------------------------------------------------
    // Case A: Background image applies — re-render source page with a
    // transparent background, draw the bg image first, then place the
    // transparent re-render on top so original content reads over the image.
    // Watermark and fabric edits layer normally on top of that.
    // ------------------------------------------------------------------
    if (needsBackground) {
      const sourcePage = sourcePdf.getPage(pageNum - 1);
      const { height: pdfHeight, width: pdfWidth } = sourcePage.getSize();
      const newPage = outputPdf.addPage([pdfWidth, pdfHeight]);

      const bgImg = bgImageOnce!;
      const rect = computeBackgroundImageRect(
        bgImg.width,
        bgImg.height,
        pdfWidth,
        pdfHeight,
        bg!.fit,
      );

      newPage.drawImage(bgImg, { ...rect, opacity: bg!.opacity });

      const pdfjsPage = await pdfDocument.getPage(pageNum);
      const transparentPng = await renderPageToPng(pdfjsPage, {
        // Same per-page strategy as Case 3 — keep source text in the
        // raster unless the user actually modified some editModeText.
        suppressText: hasModifiedSourceText,
        transparent: true,
      });
      const pageRender = await outputPdf.embedPng(transparentPng);

      newPage.drawImage(pageRender, {
        height: pdfHeight,
        width: pdfWidth,
        x: 0,
        y: 0,
      });

      if (needsWatermark && !isOverlay) {
        await drawWatermarkOnPage(newPage, outputPdf, wm!);
      }

      if (hasGenuineEdits) {
        const json = fabricJsonByPage.get(pageNum)!;
        const parsed = parseFabricJson(json);

        if (parsed) {
          // Same per-page strategy as Case 3 — include all overlays
          // when raster suppressed source text (user modified some
          // editModeText), otherwise skip the pristine editModeText
          // since its text is already painted in the raster.
          const allObjects = (parsed.objects ?? []) as FabricObj[];
          const objects = hasModifiedSourceText
            ? allObjects
            : allObjects.filter(
                (o) =>
                  (o as { editorType?: string }).editorType !== "editModeText",
              );

          if (objects.length) {
            // Fabric canvas was sized to the ROTATED viewport for /Rotate
            // pages, but sourcePage.getSize() returns MediaBox dims (always
            // unrotated). Swap them when /Rotate is 90 or 270 so scaleX/Y
            // line up with Fabric coords.
            const srcRot = sourcePage.getRotation().angle;
            const sideways = srcRot === 90 || srcRot === 270;
            const ctx = createCoordinateContext(
              parsed.width,
              parsed.height,
              sideways ? pdfHeight : pdfWidth,
              sideways ? pdfWidth : pdfHeight,
            );

            await processPageObjects(
              objects,
              parsed,
              newPage,
              outputPdf,
              ctx,
              fontCache,
            );
          }
        }
      }

      if (needsWatermark && isOverlay) {
        await drawWatermarkOnPage(newPage, outputPdf, wm!);
      }

      continue;
    }

    // ------------------------------------------------------------------
    // Case 1: No edits, no watermark — copy as-is
    // ------------------------------------------------------------------
    if (!hasGenuineEdits && !needsWatermark) {
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageNum - 1]);

      outputPdf.addPage(copiedPage);
      continue;
    }

    // ------------------------------------------------------------------
    // Case 2: No edits, needs watermark — copy page + draw watermark on top.
    // For unedited pages, overlay and underlay produce the same visual result
    // since there are no Fabric objects to layer against. The watermark is
    // drawn on top of the original vector content (preserves quality).
    // ------------------------------------------------------------------
    if (!hasGenuineEdits && needsWatermark) {
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageNum - 1]);

      outputPdf.addPage(copiedPage);
      const targetPage = outputPdf.getPage(outputPdf.getPageCount() - 1);

      await drawWatermarkOnPage(targetPage, outputPdf, wm);
      continue;
    }

    // ------------------------------------------------------------------
    // Case 3: Has edits (and possibly watermark) — two sub-paths.
    //
    // The branch hinges on whether the page has editModeText overlays
    // (auto-extracted source text that the user activated Edit Text
    // on). Those overlays MAY have been modified by the user — to
    // preserve the modification we have to bake them into the saved
    // bytes. We do that via the raster batch (PNG render of the
    // Fabric IText via browser canvas — full Unicode, no boxes) and
    // suppress the source text in the page raster so the modification
    // doesn't duplicate against the original.
    //
    //   • Path A — page has editModeText overlays:
    //       Render the source page to PNG with text suppressed,
    //       embed as background, draw ALL Fabric objects on top.
    //       Both editModeText and annotations route through raster
    //       (per `isVectorizable`), preserving every Unicode glyph.
    //       Cost: source text on this page becomes an image (not
    //       selectable after save). User edits persist exactly.
    //
    //   • Path B — page has no editModeText overlays:
    //       `copyPages` the source verbatim (text preserved), draw
    //       user overlays on top. No rasterization. Source text
    //       stays selectable. This is the common case for "add
    //       annotation/shape/page number without touching text."
    // ------------------------------------------------------------------
    const sourcePage = sourcePdf.getPage(pageNum - 1);
    const { height: pdfHeight, width: pdfWidth } = sourcePage.getSize();

    const json = fabricJsonByPage.get(pageNum)!;
    const parsed = parseFabricJson(json);
    const allObjects = (parsed?.objects ?? []) as FabricObj[];
    const hasEditModeText = allObjects.some(
      (o) => (o as { editorType?: string }).editorType === "editModeText",
    );

    if (hasEditModeText) {
      // Path A: rasterize source without text, draw all overlays.
      const pdfjsPage = await pdfDocument.getPage(pageNum);
      const pngBytes = await renderPageToPng(pdfjsPage, {
        suppressText: true,
      });
      const bgImage = await outputPdf.embedPng(pngBytes);
      const newPage = outputPdf.addPage([pdfWidth, pdfHeight]);

      newPage.drawImage(bgImage, {
        height: pdfHeight,
        width: pdfWidth,
        x: 0,
        y: 0,
      });

      if (needsWatermark && !isOverlay) {
        await drawWatermarkOnPage(newPage, outputPdf, wm!);
      }

      if (parsed && allObjects.length) {
        const srcRot = sourcePage.getRotation().angle;
        const sideways = srcRot === 90 || srcRot === 270;
        const ctx = createCoordinateContext(
          parsed.width,
          parsed.height,
          sideways ? pdfHeight : pdfWidth,
          sideways ? pdfWidth : pdfHeight,
        );

        await processPageObjects(
          allObjects,
          parsed,
          newPage,
          outputPdf,
          ctx,
          fontCache,
        );
      }

      if (needsWatermark && isOverlay) {
        await drawWatermarkOnPage(newPage, outputPdf, wm!);
      }

      continue;
    }

    // Path B: copy source page verbatim, draw non-editModeText
    // overlays on top. Source text remains real PDF text.
    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageNum - 1]);

    outputPdf.addPage(copiedPage);
    const newPage = outputPdf.getPage(outputPdf.getPageCount() - 1);

    if (needsWatermark && !isOverlay) {
      await drawWatermarkOnPage(newPage, outputPdf, wm!);
    }

    if (parsed && allObjects.length) {
      const srcRot = sourcePage.getRotation().angle;
      const sideways = srcRot === 90 || srcRot === 270;
      const ctx = createCoordinateContext(
        parsed.width,
        parsed.height,
        sideways ? pdfHeight : pdfWidth,
        sideways ? pdfWidth : pdfHeight,
      );

      await processPageObjects(
        allObjects,
        parsed,
        newPage,
        outputPdf,
        ctx,
        fontCache,
      );
    }

    if (needsWatermark && isOverlay) {
      await drawWatermarkOnPage(newPage, outputPdf, wm!);
    }
  }

  return outputPdf.save();
}
