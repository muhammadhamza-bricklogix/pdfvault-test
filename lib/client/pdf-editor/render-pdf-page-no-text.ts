import type { PDFPageProxy } from "pdfjs-dist";

// pdf.js operator indices for text rendering (same as use-page-renderer)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

/** Raster resolution for export / merge; must match Fabric `toDataURL` multiplier. */
export const PDF_EXPORT_RASTER_MULTIPLIER = 3;

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob returned null"));

          return;
        }

        void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      },
      "image/png",
      1,
    );
  });
}

/**
 * Renders one PDF.js page to PNG at `multiplier`× scale with all text operators
 * skipped (same idea as the editor’s suppressText canvas). Fills white first so
 * the bitmap fully covers native text when drawn on top of the original page.
 */
export async function renderPdfPageToPngWithoutText(
  pageProxy: PDFPageProxy,
  multiplier: number,
): Promise<Uint8Array> {
  const viewport = pageProxy.getViewport({ scale: multiplier });
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get 2D context for PDF export");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const opList = await pageProxy.getOperatorList();
  const textIndices = new Set<number>();

  for (let i = 0; i < opList.fnArray.length; i++) {
    const op = opList.fnArray[i];

    if (op >= TEXT_OPS_MIN && op <= TEXT_OPS_MAX) {
      textIndices.add(i);
    }
  }

  const task = pageProxy.render({
    canvas,
    operationsFilter: (index: number) => !textIndices.has(index),
    viewport,
  });

  await task.promise;

  return canvasToPngBytes(canvas);
}
