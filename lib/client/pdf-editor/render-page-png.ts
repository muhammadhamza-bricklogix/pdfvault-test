import type { PDFPageProxy } from "pdfjs-dist";

import { getExportRasterScale } from "./raster-config";

// pdf.js OPS constants for text rendering operations (31–49)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

export type RenderPageOptions = {
  /** Clockwise rotation in degrees applied to the rendered viewport (default 0). */
  rotation?: number;
  /** Suppress pdf.js text rendering ops (default true). */
  suppressText?: boolean;
  /** Render against a transparent background (default false). */
  transparent?: boolean;
  /** Raster scale override — clamped to the configured maximum. */
  scale?: number;
};

/**
 * Renders a pdf.js page to a PNG byte array. Supports text suppression,
 * transparent backgrounds, explicit rotation, and a configurable/capped
 * raster scale.
 */
export async function renderPageToPng(
  page: PDFPageProxy,
  options: RenderPageOptions = {},
): Promise<Uint8Array> {
  const {
    rotation = 0,
    suppressText = true,
    transparent = false,
    scale: requestedScale,
  } = options;
  const scale = getExportRasterScale(requestedScale);
  const viewport = page.getViewport({ rotation, scale });

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
