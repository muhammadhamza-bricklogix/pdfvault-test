import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { degrees } from "pdf-lib";

type BuildPdfInput = {
  importedPdfs: Map<string, ArrayBuffer>;
  pages: DraftPage[];
  sourceBytes: ArrayBuffer;
};

export async function buildPdfFromDraft({
  importedPdfs,
  pages,
  sourceBytes,
}: BuildPdfInput): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");

  const sourcePdf = await PDFDocument.load(sourceBytes);
  const outputPdf = await PDFDocument.create();

  for (const entry of pages) {
    if (entry.kind === "blank") {
      const page = outputPdf.addPage([entry.widthPt, entry.heightPt]);

      if (entry.rotation) {
        page.setRotation(degrees(entry.rotation));
      }

      page.drawRectangle({
        color: rgb(1, 1, 1),
        height: entry.heightPt,
        width: entry.widthPt,
        x: 0,
        y: 0,
      });
      continue;
    }

    if (entry.kind === "source") {
      const [copied] = await outputPdf.copyPages(sourcePdf, [
        entry.sourcePageIndex - 1,
      ]);
      const page = outputPdf.addPage(copied);

      if (entry.rotation) {
        page.setRotation(degrees(entry.rotation));
      }

      continue;
    }

    const importBytes = importedPdfs.get(entry.importKey);

    if (!importBytes) continue;

    const importDoc = await PDFDocument.load(importBytes);
    const [copied] = await outputPdf.copyPages(importDoc, [
      entry.importPageIndex - 1,
    ]);
    const page = outputPdf.addPage(copied);

    if (entry.rotation) {
      page.setRotation(degrees(entry.rotation));
    }
  }

  return outputPdf.save();
}
