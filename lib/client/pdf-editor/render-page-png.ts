import type { PDFPageProxy } from "pdfjs-dist";

// pdf.js OPS constants for text rendering operations (31–49)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

// Background raster scale — 3× for high quality output
const RASTER_SCALE = 3;

export type RenderPageOptions = {
  /** Suppress pdf.js text rendering ops (default true). */
  suppressText?: boolean;
  /** Render against a transparent background (default false). */
  transparent?: boolean;
};

/**
 * Renders a pdf.js page to a PNG byte array. Supports text suppression and
 * transparent backgrounds — used both by the editor export (merge-pdf) and by
 * the manage-pages save pipeline (build-pages-pdf) when a colored background
 * is requested behind original page content.
 */
export async function renderPageToPng(
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
