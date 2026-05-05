import {
  dataUrlToBytes,
  parseFabricJson,
  renderFabricJsonToPng,
} from "./save-utils";

export type MergePdfInput = {
  /** Map of 1-indexed page number → Fabric canvas JSON. */
  fabricJsonByPage: Map<number, string>;
  /** Original PDF bytes. */
  sourceBytes: ArrayBuffer;
};

/**
 * Loads the source PDF and stamps each page's Fabric overlay (as a PNG
 * stretched to fill the page) on top, then returns the saved bytes.
 */
export async function mergeFabricEditsIntoPdf({
  fabricJsonByPage,
  sourceBytes,
}: MergePdfInput): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();

  for (const [pageNumber, json] of Array.from(fabricJsonByPage.entries())) {
    const page = pages[pageNumber - 1];

    if (!page) continue;

    const parsed = parseFabricJson(json);

    if (!parsed) continue;

    const pngDataUrl = await renderFabricJsonToPng(parsed);
    const pngBytes = dataUrlToBytes(pngDataUrl);
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const { height, width } = page.getSize();

    page.drawImage(pngImage, { height, width, x: 0, y: 0 });
  }

  return pdfDoc.save();
}
