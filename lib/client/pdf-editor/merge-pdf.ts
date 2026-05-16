import type { PDFDocument, PDFPage } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { CoordinateContext } from "./coordinate-transform";
import type { ParsedFabricJson } from "./save-utils";
import type { FontData } from "./text-extraction";

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
  return VECTOR_TYPES.has((obj.type as string).toLowerCase());
}

// ---------------------------------------------------------------------------
// Render a pdf.js page to PNG (text-suppressed) for use as raster background
// ---------------------------------------------------------------------------

async function renderPageToPng(page: PDFPageProxy): Promise<Uint8Array> {
  const viewport = page.getViewport({ scale: RASTER_SCALE });

  const canvas = document.createElement("canvas");

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "-9999px";
  document.body.appendChild(canvas);

  try {
    // Identify text operations to suppress
    const opList = await page.getOperatorList();
    const textIndices = new Set<number>();

    for (let i = 0; i < opList.fnArray.length; i++) {
      const op = opList.fnArray[i];

      if (op >= TEXT_OPS_MIN && op <= TEXT_OPS_MAX) {
        textIndices.add(i);
      }
    }

    // Render with text suppressed
    await page.render({
      canvas,
      operationsFilter: (i: number) => !textIndices.has(i),
      viewport,
    }).promise;

    // Export as PNG bytes
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
  pageOrder,
  pdfDocument,
  sourceBytes,
}: MergePdfInput): Promise<Uint8Array> {
  const { PDFDocument: PdfDoc } = await import("pdf-lib");

  // Load source for copying unedited pages
  const sourcePdf = await PdfDoc.load(sourceBytes);

  // Create a fresh output document
  const outputPdf = await PdfDoc.create();
  const fontCache = new FontCache(outputPdf, fontDataMap);

  const order =
    pageOrder.length > 0
      ? pageOrder
      : Array.from({ length: sourcePdf.getPageCount() }, (_, i) => i + 1);

  for (let displayPage = 1; displayPage <= order.length; displayPage++) {
    const sourcePageNum = order[displayPage - 1];

    if (!fabricJsonByPage.has(sourcePageNum)) {
      // No edits — copy original page as-is (preserves vectors, fonts, etc.)
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [
        sourcePageNum - 1,
      ]);

      outputPdf.addPage(copiedPage);
      continue;
    }

    // Page has edits — rasterize background + draw Fabric objects
    const sourcePage = sourcePdf.getPage(sourcePageNum - 1);
    const { height: pdfHeight, width: pdfWidth } = sourcePage.getSize();

    // 1. Render original page to PNG (text-suppressed)
    const pdfjsPage = await pdfDocument.getPage(sourcePageNum);
    const pngBytes = await renderPageToPng(pdfjsPage);

    // 2. Create new page with same dimensions
    const newPage = outputPdf.addPage([pdfWidth, pdfHeight]);

    // 3. Embed and draw rasterized background
    const bgImage = await outputPdf.embedPng(pngBytes);

    newPage.drawImage(bgImage, {
      height: pdfHeight,
      width: pdfWidth,
      x: 0,
      y: 0,
    });

    // 4. Draw all Fabric objects on top
    const json = fabricJsonByPage.get(sourcePageNum)!;
    const parsed = parseFabricJson(json);

    if (parsed) {
      const objects = (parsed.objects ?? []) as FabricObj[];

      if (objects.length) {
        const ctx = createCoordinateContext(
          parsed.width,
          parsed.height,
          pdfWidth,
          pdfHeight,
        );

        console.log(
          `[MergePDF] CoordinateContext: fabricW=${parsed.width} fabricH=${parsed.height} pdfW=${pdfWidth} pdfH=${pdfHeight} scaleX=${ctx.scaleX.toFixed(6)} scaleY=${ctx.scaleY.toFixed(6)}`,
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

  return outputPdf.save();
}
