import {
  PDF_EXPORT_RASTER_MULTIPLIER,
  renderPdfPageToPngWithoutText,
} from "./render-pdf-page-no-text";
import {
  dataUrlToBytes,
  parseFabricJson,
  renderFabricJsonToPng,
} from "./save-utils";
import { PDFJS_WORKER_SRC } from "./pdfjs-worker";

export type MergePdfInput = {
  /** Map of 1-indexed page number → Fabric canvas JSON. */
  fabricJsonByPage: Map<number, string>;
  /** Original PDF bytes. */
  sourceBytes: ArrayBuffer;
};

/**
 * For each page that has Fabric edits, paints:
 * 1. A full-page bitmap of the PDF **without** text (matches the on-screen
 *    suppressText layer), so native text is not duplicated in the file.
 * 2. A full Fabric composite at the same resolution (matches the overlay).
 *
 * This mirrors what the user sees in the editor and avoids WinAnsi / vector
 * text encoding issues from the old pdf-lib-only path.
 */
export async function mergeFabricEditsIntoPdf({
  fabricJsonByPage,
  sourceBytes,
}: MergePdfInput): Promise<Uint8Array> {
  const { PDFDocument: PdfDoc } = await import("pdf-lib");
  const pdfDoc = await PdfDoc.load(sourceBytes);
  const pages = pdfDoc.getPages();
  const pdfData = new Uint8Array(sourceBytes);

  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  const pdfjsDoc = await pdfjs.getDocument({ data: pdfData }).promise;

  try {
    for (const [pageNumber, json] of Array.from(fabricJsonByPage.entries())) {
      const libPage = pages[pageNumber - 1];

      if (!libPage) continue;

      const parsed = parseFabricJson(json);

      if (!parsed) continue;

      if (!(parsed.objects ?? []).length) continue;

      const { height: pdfH, width: pdfW } = libPage.getSize();
      const pageProxy = await pdfjsDoc.getPage(pageNumber);
      const k = PDF_EXPORT_RASTER_MULTIPLIER;

      const bgBytes = await renderPdfPageToPngWithoutText(pageProxy, k);
      const bgImg = await pdfDoc.embedPng(bgBytes);

      libPage.drawImage(bgImg, { height: pdfH, width: pdfW, x: 0, y: 0 });

      const fabricUrl = await renderFabricJsonToPng(parsed, k);
      const fabricBytes = dataUrlToBytes(fabricUrl);
      const fgImg = await pdfDoc.embedPng(fabricBytes);

      libPage.drawImage(fgImg, { height: pdfH, width: pdfW, x: 0, y: 0 });
    }
  } finally {
    await pdfjsDoc.destroy();
  }

  return pdfDoc.save();
}
