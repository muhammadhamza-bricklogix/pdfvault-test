import type { PDFDocument, PDFPage } from "pdf-lib";
import type { CoordinateContext } from "./coordinate-transform";
import type { ParsedFabricJson } from "./save-utils";

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
  /** Map of 1-indexed page number → Fabric canvas JSON. */
  fabricJsonByPage: Map<number, string>;
  /** Original PDF bytes. */
  sourceBytes: ArrayBuffer;
};

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
// Public API — unchanged signature
// ---------------------------------------------------------------------------

/**
 * Loads the source PDF and merges each page's Fabric edits using a hybrid
 * strategy: vectorizable objects (text, shapes, paths) are drawn directly
 * via pdf-lib drawing commands; bitmap objects (images, signatures) are
 * rasterized to PNG and overlaid. Z-order is preserved.
 */
export async function mergeFabricEditsIntoPdf({
  fabricJsonByPage,
  sourceBytes,
}: MergePdfInput): Promise<Uint8Array> {
  const { PDFDocument: PdfDoc } = await import("pdf-lib");
  const pdfDoc = await PdfDoc.load(sourceBytes);
  const pages = pdfDoc.getPages();
  const fontCache = new FontCache(pdfDoc);

  for (const [pageNumber, json] of Array.from(fabricJsonByPage.entries())) {
    const page = pages[pageNumber - 1];

    if (!page) continue;

    const parsed = parseFabricJson(json);

    if (!parsed) continue;

    const objects = (parsed.objects ?? []) as FabricObj[];

    if (!objects.length) continue;

    const { height: pdfHeight, width: pdfWidth } = page.getSize();
    const ctx = createCoordinateContext(
      parsed.width,
      parsed.height,
      pdfWidth,
      pdfHeight,
    );

    await processPageObjects(objects, parsed, page, pdfDoc, ctx, fontCache);
  }

  return pdfDoc.save();
}
