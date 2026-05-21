import type { PageRotation } from "@/lib/client/hooks/pdf-editor/manage-pages-types";
import type { PDFDocument } from "pdf-lib";

import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib";

type AppendPageOptions = {
  heightPt?: number;
  rotation?: PageRotation;
  widthPt?: number;
};

type Matrix6 = [number, number, number, number, number, number];

/**
 * Returns the cm matrix + destination page dims that physically rotate a
 * source page (W × H) by the given clockwise screen-space angle. PDF Y axis
 * is bottom-up, so each matrix is derived by mapping the four source corners
 * to their post-rotation destination positions.
 */
function computeRotationTransform(
  rotation: PageRotation,
  W: number,
  H: number,
): { dstH: number; dstW: number; matrix: Matrix6 } {
  switch (rotation) {
    case 90:
      return { dstH: W, dstW: H, matrix: [0, -1, 1, 0, 0, W] };
    case 180:
      return { dstH: H, dstW: W, matrix: [-1, 0, 0, -1, W, H] };
    case 270:
      return { dstH: W, dstW: H, matrix: [0, 1, -1, 0, H, 0] };
    default:
      return { dstH: H, dstW: W, matrix: [1, 0, 0, 1, 0, 0] };
  }
}

/**
 * Copies a page into the output document, optionally fitting content into
 * new dimensions and/or rotating it.
 *
 * Rotation is baked into the content stream (via cm transform applied to an
 * embedded XObject) — the output page's `/Rotate` stays 0. This keeps text
 * positions and the displayed layout in sync so downstream editor flows
 * (text extraction, edit-text mode, export) work correctly.
 */
export async function appendPdfPage(
  outputPdf: PDFDocument,
  sourceDoc: PDFDocument,
  pageIndex: number,
  { heightPt, rotation = 0, widthPt }: AppendPageOptions,
): Promise<void> {
  const sourcePage = sourceDoc.getPage(pageIndex);
  const srcW = sourcePage.getWidth();
  const srcH = sourcePage.getHeight();

  // Fast path: no resize, no rotation — straight copy preserves vector content.
  if (!widthPt && !heightPt && !rotation) {
    const [copied] = await outputPdf.copyPages(sourceDoc, [pageIndex]);

    outputPdf.addPage(copied);

    return;
  }

  // Rotation path (with or without resize): embed source as XObject, apply
  // a transformation matrix, then draw at its natural size on a freshly sized
  // destination page.
  if (rotation) {
    const { dstH, dstW, matrix } = computeRotationTransform(
      rotation,
      srcW,
      srcH,
    );

    // If caller supplied target dims, fit the rotated content into them
    // proportionally (matches the non-rotation resize behavior below).
    const targetW = widthPt ?? dstW;
    const targetH = heightPt ?? dstH;

    const embedded = await outputPdf.embedPage(sourcePage);
    const newPage = outputPdf.addPage([targetW, targetH]);

    const fitScale = Math.min(targetW / dstW, targetH / dstH);
    const drawW = dstW * fitScale;
    const drawH = dstH * fitScale;
    const offsetX = (targetW - drawW) / 2;
    const offsetY = (targetH - drawH) / 2;

    // Compose: outer fit transform (translate + scale) then inner rotation matrix.
    // Resulting effective matrix:
    //   [a*s, b*s, c*s, d*s, s*e + offsetX, s*f + offsetY]
    const [a, b, c, d, e, f] = matrix;
    const composed: Matrix6 = [
      a * fitScale,
      b * fitScale,
      c * fitScale,
      d * fitScale,
      fitScale * e + offsetX,
      fitScale * f + offsetY,
    ];

    newPage.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(...composed),
    );
    newPage.drawPage(embedded, {
      height: srcH,
      width: srcW,
      x: 0,
      y: 0,
    });
    newPage.pushOperators(popGraphicsState());

    return;
  }

  // Resize without rotation — preserve existing behavior.
  const targetW = widthPt!;
  const targetH = heightPt!;
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
}
