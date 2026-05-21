import type { PageRotation } from "@/lib/client/hooks/pdf-editor/manage-pages-types";
import type { PDFDocument } from "pdf-lib";

import { degrees } from "pdf-lib";

type AppendPageOptions = {
  heightPt?: number;
  rotation?: PageRotation;
  widthPt?: number;
};

/**
 * Copies a page into the output document, optionally fitting content into
 * new dimensions and/or rotating it.
 *
 * Rotation is set via the page's `/Rotate` metadata (standard PDF approach).
 * The downstream editor (text-extraction → use-edit-text-mode) reads
 * `page.rotate` and applies the matching Fabric IText angle so text reads
 * correctly on rotated pages.
 */
export async function appendPdfPage(
  outputPdf: PDFDocument,
  sourceDoc: PDFDocument,
  pageIndex: number,
  { heightPt, rotation = 0, widthPt }: AppendPageOptions,
): Promise<void> {
  const targetW = widthPt;
  const targetH = heightPt;

  // `rotation` from the draft is an OFFSET applied on top of whatever the
  // source already has (the thumbnail renders source-rotated content with a
  // CSS rotate on top). Compose them so a draft delta that returns the
  // visual to 0° actually writes /Rotate=0 at save time.
  const sourceRotationAngle = sourceDoc.getPage(pageIndex).getRotation().angle;
  const finalRotation = (((sourceRotationAngle + rotation) % 360) + 360) % 360;

  if (!targetW || !targetH) {
    const [copied] = await outputPdf.copyPages(sourceDoc, [pageIndex]);
    const page = outputPdf.addPage(copied);

    // Always call setRotation (including 0) so a "reset to upright" delta
    // overrides any /Rotate that came in from the source page.
    page.setRotation(degrees(finalRotation));

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

  page.setRotation(degrees(finalRotation));
}
