import type { PDFDocumentProxy } from "pdfjs-dist";

import { dataUrlToBytes } from "./fabric-render";

/**
 * pdf-lib's `ignoreEncryption: true` suppresses the load-time throw but does
 * NOT decrypt encrypted strings/refs. Catalog dereferences then fail with
 * "Expected instance of PDFDict, but got instance of undefined". When that
 * happens we rebuild a clean source PDF by rasterizing each page via pdf.js
 * (which already decrypted the doc to render the editor) and embedding the
 * pages back into a fresh pdf-lib document. Vector text is lost on the
 * unedited background of an encrypted source, but Fabric overlay edits and
 * downstream merges still work cleanly on top.
 */
async function rebuildSourceFromPdfJs(
  pdfDocument: PDFDocumentProxy,
): Promise<ArrayBuffer> {
  const { PDFDocument } = await import("pdf-lib");
  const cleanDoc = await PDFDocument.create();

  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");

    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      page.cleanup();
      continue;
    }

    await page.render({ canvas, canvasContext: ctx, viewport: renderViewport })
      .promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const jpgBytes = dataUrlToBytes(dataUrl);
    const embedded = await cleanDoc.embedJpg(jpgBytes);

    const newPage = cleanDoc.addPage([baseViewport.width, baseViewport.height]);

    newPage.drawImage(embedded, {
      height: baseViewport.height,
      width: baseViewport.width,
      x: 0,
      y: 0,
    });

    page.cleanup();
  }

  const bytes = await cleanDoc.save();

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/**
 * Returns sourceBytes if pdf-lib can parse them cleanly. Otherwise rebuilds a
 * decrypted copy via pdf.js. The probe must call a real catalog-traversing
 * method (getPageCount) because encryption-related corruption surfaces during
 * dereferencing, not during `load()`.
 */
export async function sanitizeSourceBytesForPdfLib(
  sourceBytes: ArrayBuffer,
  pdfDocument: PDFDocumentProxy,
): Promise<ArrayBuffer> {
  const { PDFDocument } = await import("pdf-lib");

  try {
    const probe = await PDFDocument.load(sourceBytes, {
      ignoreEncryption: true,
    });
    const count = probe.getPageCount();

    if (count > 0) return sourceBytes;
  } catch {
    // fall through to rebuild
  }

  return rebuildSourceFromPdfJs(pdfDocument);
}
