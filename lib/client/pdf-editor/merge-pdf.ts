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

import { rgb } from "pdf-lib";

import { logger } from "@/lib/shared/utils/logger";

import {
  createCoordinateContext,
  toPdfDim,
  toPdfX,
} from "./coordinate-transform";
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
  drawPath,
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
  "path",
  "rect",
  "text",
  "textbox",
  "triangle",
]);
// "image" (signature stamps, uploaded PNGs) still goes through raster
// (PNG at multiplier:3) — pdf-lib can't stroke raw image data as vectors.
// "path" is vectorizable via drawPath → drawSvgPath (2026-07-23 fix). The
// raster fallback exists for anything drawVectorObject returns false on.

function isVectorizable(obj: FabricObj): boolean {
  // Annotation glyphs contain arbitrary Unicode. pdf-lib's `drawText` uses
  // StandardFonts (WinAnsi-encoded only) and silently replaces unencodable
  // glyphs with "?" via `sanitizeTextForFont`. Routing them through the
  // raster batch path renders each via the browser canvas (full Unicode),
  // preserving every glyph as a PNG.
  const editorType = (obj as { editorType?: string }).editorType;

  if (editorType === "annotation") {
    return false;
  }

  // editModeText: route MODIFIED ones through the vector pipeline so the
  // page stays text-extractable on reload (instead of rasterising the
  // whole page, which produces the "No editable text found" toast). The
  // embedded source font handles the original PDF's encoding correctly
  // since the glyphs came FROM that font in the first place. Unmodified
  // ones are filtered out upstream — the source page already carries the
  // real text via copyPages.
  if (editorType === "editModeText") {
    return true;
  }

  return VECTOR_TYPES.has((obj.type as string).toLowerCase());
}

/**
 * Was this auto-extracted source-text IText modified by the user?
 *
 * Primary signal: `pristine`. Every editModeText IText is created with
 * `pristine: true` in `use-edit-text-mode.ts`; `use-editor-history.ts`
 * listens for `text:changed` + `object:modified` on editModeText objects
 * and flips `pristine = false` ONLY on a genuine user action (typing,
 * dragging, resizing). So `pristine === true` is a reliable "user didn't
 * touch this" marker, and anything else means "treat as modified".
 *
 * Why not compare `text/originalText/left/top` directly? Fabric IText
 * can normalise its own `text` string on construction (line-ending
 * coercion, etc.) and the canvas can shift `left`/`top` by sub-pixel
 * amounts during layout — both of which flag every block as "modified"
 * even when the user only typed into one of them. That produced the
 * "every word on the edited line shows duplicated" symptom reported
 * 2026-06-17. Pristine sidesteps both since it only changes on a real
 * Fabric event, not on layout side-effects.
 */
function isModifiedEditModeText(obj: FabricObj): boolean {
  if ((obj as { editorType?: string }).editorType !== "editModeText") {
    return false;
  }

  return (obj as { pristine?: boolean }).pristine !== true;
}

/**
 * Aggregate diagnostic for a page's editModeText breakdown. Logged inside
 * the merge loop so we can see, for the page being saved, how many
 * editModeText were on it, how many were classified as modified (drawn
 * via vector + whiteout), and what the raw values looked like. If this
 * shows `modified == total`, something flipped `pristine` on every block
 * (most likely the toJSON round-trip dropped the flag).
 */
function logMergeEditModeTextSummary(
  pageNum: number,
  parsed: ParsedFabricJson,
): void {
  const all = (parsed.objects ?? []) as FabricObj[];
  const eds = all.filter(
    (o) => (o as { editorType?: string }).editorType === "editModeText",
  );

  if (!eds.length) return;
  const modified = eds.filter(isModifiedEditModeText);

  logger.debug("[PDFedits] merge: editModeText on page", {
    page: pageNum,
    total: eds.length,
    modifiedDrawn: modified.length,
    pristineSkipped: eds.length - modified.length,
    samples: eds.slice(0, 5).map((o) => ({
      text:
        typeof (o as { text?: string }).text === "string"
          ? (o as { text?: string }).text!.slice(0, 24)
          : null,
      originalText:
        typeof (o as { originalText?: string }).originalText === "string"
          ? (o as { originalText?: string }).originalText!.slice(0, 24)
          : null,
      pristine: (o as { pristine?: boolean }).pristine,
      isModified: isModifiedEditModeText(o),
    })),
  });
}

/**
 * Draws an opaque-white rectangle over the source-text bounding box of a
 * modified editModeText object. The user's modified IText is drawn on top
 * via the normal vector pipeline; without this whiteout the original word
 * would still appear underneath (copyPages preserves it byte-for-byte).
 *
 * Coordinates: `originalLeft`/`originalTop`/`originalWidth`/`originalHeight`
 * are in Fabric base space (zoom=1). The coord context maps them to PDF
 * points. A small padding cushions font-metric jitter between Fabric's
 * canvas measurement and pdf.js's reported advance width.
 */
function whiteoutSourceText(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const o = obj as {
    originalLeft?: number;
    originalTop?: number;
    originalWidth?: number;
    originalHeight?: number;
    fontSize?: number;
  };

  if (
    o.originalLeft === undefined ||
    o.originalTop === undefined ||
    o.originalWidth === undefined ||
    o.originalHeight === undefined
  ) {
    return;
  }

  // Generous coverage: `originalHeight` from pdf.js is usually the cap
  // height (font size in viewport units) which sits ABOVE the baseline.
  // Real-world glyphs extend a bit above the cap (diacritics) and below
  // the baseline (descenders), so a tight `originalHeight` rect lets the
  // tops of capitals + the tails of `g`/`p`/`y` peek through the whiteout
  // — invisible in the main editor (the Fabric IText overlay re-paints
  // those pixels) but plainly visible in any raw pdf.js render path
  // (e.g. the Version Preview modal, which uses
  // `p.render({ canvasContext })` with no text suppression). Pad enough
  // vertically to cover an ascender's worth above the top and a
  // descender's worth below the bottom of `originalHeight`. Horizontal
  // padding stays small — pdf.js's reported advance width is reliable.
  const fontSize = (o.fontSize as number | undefined) ?? o.originalHeight;
  const padX = 2;
  const padTop = fontSize * 0.35;
  const padBottom = fontSize * 0.55;
  const fabricLeft = o.originalLeft - padX;
  const fabricTop = o.originalTop - padTop;
  const fabricWidth = o.originalWidth + padX * 2;
  const fabricHeight = o.originalHeight + padTop + padBottom;

  const pdfX = toPdfX(fabricLeft, ctx);
  const pdfW = toPdfDim(fabricWidth, ctx.scaleX);
  const pdfH = toPdfDim(fabricHeight, ctx.scaleY);
  // pdf-lib rectangle Y is the BOTTOM edge; Fabric top is the TOP edge.
  const pdfY = ctx.pdfHeight - toPdfDim(fabricTop, ctx.scaleY) - pdfH;

  page.drawRectangle({
    x: pdfX,
    y: pdfY,
    width: pdfW,
    height: pdfH,
    color: rgb(1, 1, 1),
    opacity: 1,
  });

  logger.debug("[PDFedits] whiteout: drew rect over source word", {
    text:
      typeof (obj as { originalText?: string }).originalText === "string"
        ? (obj as { originalText?: string }).originalText!.slice(0, 24)
        : null,
    fabricLeft: o.originalLeft,
    fabricTop: o.originalTop,
    fabricWidth: o.originalWidth,
    fabricHeight: o.originalHeight,
    fontSize,
    padTop,
    padBottom,
    pdfX,
    pdfY,
    pdfW,
    pdfH,
  });
}

type RenderPagePngResult = {
  /** Raw PNG bytes. */
  png: Uint8Array;
  /** Rendered width in PDF points (viewport width / render scale). */
  width: number;
  /** Rendered height in PDF points (viewport height / render scale). */
  height: number;
};

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
): Promise<RenderPagePngResult> {
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

    return {
      height: viewport.height / RASTER_SCALE,
      png: new Uint8Array(await blob.arrayBuffer()),
      width: viewport.width / RASTER_SCALE,
    };
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

    case "path":
      // Freehand drawings (Pencil tool). `vector-drawers` already exposes
      // `drawPath` — it was reachable only via `drawGroup`'s child dispatch
      // before, so a top-level Path fell through to the raster fallback and
      // silently NEVER baked into the saved PDF (QA report 2026-07-23:
      // "drawings don't show up in the version-history preview" — pdf.js
      // was rendering the raw bytes and finding no paint operators for
      // the drawing).
      drawPath(obj, page, ctx);

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
  // EXPORT-DIAG: accumulators for per-page breakdown of what actually gets
  // drawn vs. rastered vs. failed (silently or with an exception).
  const diag = {
    vectorDrawn: 0,
    vectorFallbackToRaster: 0,
    vectorThrew: 0,
    rasterQueued: 0,
    byType: {} as Record<string, number>,
    errors: [] as { type: string; editorType?: string; message: string }[],
  };

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const typeKey = `${(obj.type as string | undefined) ?? "?"}${
      (obj as { editorType?: string }).editorType
        ? `:${(obj as { editorType?: string }).editorType}`
        : ""
    }`;

    diag.byType[typeKey] = (diag.byType[typeKey] ?? 0) + 1;

    if (isVectorizable(obj)) {
      // Flush any accumulated raster objects first (preserves z-order)
      if (rasterBatch.length) {
        await flushRasterBatch(rasterBatch, parsed, page, pdfDoc);
        rasterBatch = [];
      }

      let drawn = false;

      try {
        drawn = await drawVectorObject(obj, page, ctx, fontCache);
      } catch (err) {
        diag.vectorThrew += 1;
        diag.errors.push({
          type: (obj.type as string) ?? "?",
          editorType: (obj as { editorType?: string }).editorType,
          message: err instanceof Error ? err.message : String(err),
        });
        logger.warn("[PDFedits] EXPORT-DIAG: vector drawer threw", {
          type: obj.type,
          editorType: (obj as { editorType?: string }).editorType,
          err,
        });
      }

      // If the vector drawer couldn't handle it (e.g. unknown group children),
      // fall back to raster for this specific object
      if (!drawn) {
        rasterBatch.push(i);
        diag.vectorFallbackToRaster += 1;
      } else {
        diag.vectorDrawn += 1;
      }
    } else {
      // Rasterizable object (image, or unknown type)
      rasterBatch.push(i);
      diag.rasterQueued += 1;
    }
  }

  // Flush remaining raster objects
  if (rasterBatch.length) {
    await flushRasterBatch(rasterBatch, parsed, page, pdfDoc);
  }

  logger.info("[PDFedits] EXPORT-DIAG: processPageObjects done", {
    totalObjects: objects.length,
    ...diag,
  });
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

  // EXPORT-DIAG: what did the merge actually receive? Correlates with the
  // per-page draw logs below so we can see, for a page that "lost" edits,
  // whether the input JSON already had them dropped or whether they were
  // present at merge start but got filtered out by hasGenuineEdits / the
  // vector/raster batching in processPageObjects.
  try {
    const inputSummary: Record<
      number,
      { count: number; types: string[]; modifiedEditModeText: number }
    > = {};

    fabricJsonByPage.forEach((json, pageNum) => {
      try {
        const parsed = JSON.parse(json) as {
          objects?: {
            type?: string;
            editorType?: string;
            pristine?: boolean;
          }[];
        };
        const objs = parsed.objects ?? [];

        inputSummary[pageNum] = {
          count: objs.length,
          types: objs.map(
            (o) => `${o.type ?? "?"}${o.editorType ? `:${o.editorType}` : ""}`,
          ),
          modifiedEditModeText: objs.filter(
            (o) => o.editorType === "editModeText" && o.pristine !== true,
          ).length,
        };
      } catch {
        inputSummary[pageNum] = {
          count: -1,
          types: [],
          modifiedEditModeText: 0,
        };
      }
    });
    logger.info("[PDFedits] EXPORT-DIAG: mergeFabricEditsIntoPdf entry", {
      totalPages,
      pagesWithFabricJson: Array.from(fabricJsonByPage.keys()),
      inputSummary,
      watermarkEnabled: !!watermarkConfig?.enabled,
      backgroundImageEnabled: !!backgroundImageConfig?.enabled,
    });
  } catch (diagErr) {
    logger.warn("[PDFedits] EXPORT-DIAG: merge entry log failed", diagErr);
  }

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
    // A page "has edits" if any Fabric JSON exists for it. The
    // auto-extracted source-text IText overlays (`editorType ===
    // "editModeText"`) end up in `fabricJsonByPage` even when the user
    // never touched them — those get filtered out inside Case 3 so the
    // page is still copyPages'd byte-for-byte (preserves real PDF text).
    // Modified editModeText goes through whiteout + vector drawIText so
    // the edit replaces the source word AND the page stays text-editable
    // on reload (no rasterisation). See skill log 2026-06-17 (a).
    const hasEdits = fabricJsonByPage.has(pageNum);
    const hasGenuineEdits = hasEdits;

    // EXPORT-DIAG: per-page routing decision. If hasEdits=false when the user
    // KNOWS they made edits on this page, the drop happened upstream (flush
    // or serialize). If hasEdits=true but the exported PDF is missing them,
    // the drop happened in processPageObjects / vector drawers.
    logger.info("[PDFedits] EXPORT-DIAG: merge page routing", {
      pageNum,
      hasEdits,
      hasGenuineEdits,
      willNeedWatermark:
        wm != null &&
        shouldWatermarkPage(
          pageNum,
          totalPages,
          wm.pageScope,
          wm.customPageRange,
        ),
    });

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
      const transparentRender = await renderPageToPng(pdfjsPage, {
        // Keep the source text in the raster — modified editModeText
        // gets whiteout + vector drawIText AFTER this render is placed,
        // so the source word is covered and the new text is rendered as
        // selectable PDF text on top. Suppressing here would lose all
        // source text on bg-image pages.
        suppressText: false,
        transparent: true,
      });
      const pageRender = await outputPdf.embedPng(transparentRender.png);

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
          logMergeEditModeTextSummary(pageNum, parsed);
          const allObjects = (parsed.objects ?? []) as FabricObj[];
          // Keep modified editModeText (whiteout + vector draw); filter
          // out unmodified ones (source page already carries that text).
          const objects = allObjects.filter((o) => {
            const ed = (o as { editorType?: string }).editorType;

            if (ed !== "editModeText") return true;

            return isModifiedEditModeText(o);
          });

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

            // Whiteout pre-pass — covers source text under modified
            // editModeText so the new text replaces (not stacks).
            for (const o of objects) {
              if (isModifiedEditModeText(o)) {
                whiteoutSourceText(o, newPage, ctx);
              }
            }

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
    // Case 3: Has edits.
    //
    // Always copyPages so source text stays as real PDF objects (the
    // page remains text-editable on reload). Process Fabric overlays
    // on top:
    //   - unmodified editModeText: skipped (source page already has it).
    //   - modified editModeText: whiteout the source word + drawIText
    //     the new text using the embedded source font, so the edit
    //     replaces the original AND stays selectable on reload.
    //   - all other overlays: vector or raster via processPageObjects.
    //
    // No path rasterises the whole page any more, so "No editable text
    // found" on a saved doc with edited text is the symptom this fixes.
    // ------------------------------------------------------------------
    const sourcePage = sourcePdf.getPage(pageNum - 1);
    const { height: pdfHeight, width: pdfWidth } = sourcePage.getSize();
    const srcRot = sourcePage.getRotation().angle;

    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageNum - 1]);

    outputPdf.addPage(copiedPage);
    const newPage = outputPdf.getPage(outputPdf.getPageCount() - 1);

    // Underlay watermark — between source content and user overlays.
    if (needsWatermark && !isOverlay) {
      await drawWatermarkOnPage(newPage, outputPdf, wm!);
    }

    const json = fabricJsonByPage.get(pageNum)!;
    const parsed = parseFabricJson(json);

    if (parsed) {
      logMergeEditModeTextSummary(pageNum, parsed);
      const allObjects = (parsed.objects ?? []) as FabricObj[];
      // Keep modified editModeText (whiteout + vector draw); filter out
      // unmodified ones (the copied source page already carries that text).
      const objects = allObjects.filter((o) => {
        const ed = (o as { editorType?: string }).editorType;

        if (ed !== "editModeText") return true;

        return isModifiedEditModeText(o);
      });

      if (objects.length) {
        const sideways = srcRot === 90 || srcRot === 270;
        const ctx = createCoordinateContext(
          parsed.width,
          parsed.height,
          sideways ? pdfHeight : pdfWidth,
          sideways ? pdfWidth : pdfHeight,
        );

        // EXPORT-DIAG: coordinate context + per-object spatial summary.
        // Diagnoses the "edits pinned to the top of the exported page" bug
        // where Fabric coords don't map to the right PDF Y. If `scaleY`
        // is much smaller than 1 (parsed.height >> pdfHeight), every
        // object's fabricY collapses to near pdfHeight → top of PDF.
        // If a specific object shows fabricTop=0 despite the user
        // placing it lower, the drop happened at serialize / loadFromJSON.
        try {
          const spatial = objects.slice(0, 20).map((o) => ({
            type: (o as { type?: string }).type ?? "?",
            editorType: (o as { editorType?: string }).editorType,
            left: (o as { left?: number }).left,
            top: (o as { top?: number }).top,
            w:
              ((o as { width?: number }).width ?? 0) *
              ((o as { scaleX?: number }).scaleX ?? 1),
            h:
              ((o as { height?: number }).height ?? 0) *
              ((o as { scaleY?: number }).scaleY ?? 1),
            originX: (o as { originX?: string }).originX,
            originY: (o as { originY?: string }).originY,
          }));

          logger.info("[PDFedits] EXPORT-DIAG: page coord ctx", {
            pageNum,
            srcRot,
            sideways,
            parsedWidth: parsed.width,
            parsedHeight: parsed.height,
            pdfWidth,
            pdfHeight,
            ctxScaleX: ctx.scaleX,
            ctxScaleY: ctx.scaleY,
            ctxScaleMatchesUnity: Math.abs(ctx.scaleY - 1) < 0.02,
            objectCount: objects.length,
            spatialSample: spatial,
          });
        } catch (diagErr) {
          logger.warn(
            "[PDFedits] EXPORT-DIAG: coord ctx log failed",
            diagErr,
          );
        }

        // Whiteout pre-pass — paints opaque white rectangles over the
        // source-text bboxes for every modified editModeText so the new
        // text drawn by `processPageObjects` replaces the original word
        // instead of stacking on top of it.
        for (const o of objects) {
          if (isModifiedEditModeText(o)) {
            whiteoutSourceText(o, newPage, ctx);
          }
        }

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

    // Overlay watermark goes last (on top of everything)
    if (needsWatermark && isOverlay) {
      await drawWatermarkOnPage(newPage, outputPdf, wm!);
    }
  }

  return outputPdf.save();
}
