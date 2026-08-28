import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";

export type PdfPageImage = {
  /** 1-based page number the blob was rendered from. */
  page: number;
  blob: Blob;
};

/**
 * Rasterize every page of a PDF into PNG or JPG blobs entirely on the
 * client. Replaces the CloudConvert `pdf_to_png` / `pdf_to_jpg` round
 * trip for the W-9 flow because:
 *
 *   1. CloudConvert bundles multi-page output as a `.zip`. Users on
 *      `/w-9-form` asked for the images directly (no zip), and the
 *      W-9 template ships as 6 pages, so any real invoice of the tool
 *      is multi-page.
 *   2. No network hop → no CORS surprises, no CloudConvert quota, no
 *      "still processing" retry loops.
 *
 * Renders at 2× the natural page size (~144 DPI equivalent) so the
 * output stays crisp when the user opens the PNG in a viewer. JPG uses
 * quality 0.92 — visually indistinguishable from the raw rasterization
 * but ~40 % smaller on typed-text-heavy pages like the W-9.
 */
export async function renderPdfPagesToImages(
  pdfBytes: Uint8Array,
  format: "png" | "jpg",
): Promise<PdfPageImage[]> {
  const pdfjs = await loadPdfJs();

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  // pdf.js prefers its own buffer for `data:` loads — hand it a fresh
  // Uint8Array copy so a caller who wants to reuse `pdfBytes` after
  // this call doesn't get a detached ArrayBuffer.
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  const results: PdfPageImage[] = [];
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const quality = format === "jpg" ? 0.92 : undefined;
  const renderScale = 2;

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas 2D context unavailable");
      }

      // JPG can't render transparency — paint a white background first
      // so the exported image matches the printed form's paper.
      if (format === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, quality),
      );

      if (!blob) {
        throw new Error(`Failed to encode page ${i} as ${format}`);
      }

      results.push({ page: i, blob });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return results;
}
