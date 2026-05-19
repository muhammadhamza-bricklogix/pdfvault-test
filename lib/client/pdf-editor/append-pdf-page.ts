import type { PageRotation } from "@/lib/client/hooks/pdf-editor/manage-pages-types";
import type { PDFDocument } from "pdf-lib";

import { degrees } from "pdf-lib";

type AppendPageOptions = {
  heightPt?: number;
  rotation?: PageRotation;
  widthPt?: number;
};

/**
 * Copies a page into the output document, optionally fitting content into new dimensions.
 */
export async function appendPdfPage(
  outputPdf: PDFDocument,
  sourceDoc: PDFDocument,
  pageIndex: number,
  { heightPt, rotation = 0, widthPt }: AppendPageOptions,
): Promise<void> {
  const targetW = widthPt;
  const targetH = heightPt;

  if (!targetW || !targetH) {
    const [copied] = await outputPdf.copyPages(sourceDoc, [pageIndex]);
    const page = outputPdf.addPage(copied);

    if (rotation) {
      page.setRotation(degrees(rotation));
    }

    return;
  }

  const sourcePage = sourceDoc.getPage(pageIndex);
  const embedded = await outputPdf.embedPage(sourcePage);
  const page = outputPdf.addPage([targetW, targetH]);

  const scale = Math.min(targetW / embedded.width, targetH / embedded.height);
  const drawW = embedded.width * scale;
  const drawH = embedded.height * scale;
  const x = (targetW - drawW) / 2;
  const y = (targetH - drawH) / 2;

  page.drawPage(embedded, {
    height: drawH,
    width: drawW,
    x,
    y,
  });

  if (rotation) {
    page.setRotation(degrees(rotation));
  }
}
