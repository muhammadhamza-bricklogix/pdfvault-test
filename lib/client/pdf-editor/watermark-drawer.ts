/**
 * Draws watermarks onto a pdf-lib PDFPage during the export pipeline.
 * Supports text and image watermarks with opacity, rotation, positioning,
 * and tiled repeat modes.
 */
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import type { WatermarkConfig } from "@/lib/client/stores/pdf-editor-store";

import { degrees } from "pdf-lib";

import { hexToPdfColor } from "./color-utils";
import { resolveStandardFont } from "./font-mapping";
import { dataUrlToBytes } from "./fabric-render";
import { calculateTilePositions } from "./watermark-utils";

// ---------------------------------------------------------------------------
// Position resolver (PDF coordinates — origin bottom-left, Y up)
// ---------------------------------------------------------------------------

const PADDING_PTS = 40; // padding from page edges in PDF points

// Dimensions of the axis-aligned bbox that wraps a w×h rect rotated by angleDeg
// (sign-independent — only the magnitude matters for bbox size).
function rotatedBboxSize(
  w: number,
  h: number,
  angleDeg: number,
): { height: number; width: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));

  return { height: w * s + h * c, width: w * c + h * s };
}

// pdf-lib's drawText/drawImage rotates around (x, y) — the unrotated lower-left
// (origin). We want the rotated rect's CENTER to land on (cx, cy), so we solve
// for the pivot. The PDF rotation angle is -screenAngle (Fabric/UI angle is
// screen-CW positive; PDF is CCW positive).
function pivotForCenter(
  cx: number,
  cy: number,
  w: number,
  h: number,
  screenAngleDeg: number,
): { x: number; y: number } {
  const theta = (-screenAngleDeg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  return {
    x: cx - (w / 2) * cosT + (h / 2) * sinT,
    y: cy - (w / 2) * sinT - (h / 2) * cosT,
  };
}

// Page-relative center for a non-tiled watermark, computed so the rotated bbox
// sits fully inside the page minus PADDING_PTS on top/bottom edges.
function centerForPosition(
  position: string,
  pageWidth: number,
  pageHeight: number,
  rotH: number,
): { cx: number; cy: number } {
  switch (position) {
    case "top":
      return { cx: pageWidth / 2, cy: pageHeight - PADDING_PTS - rotH / 2 };
    case "bottom":
      return { cx: pageWidth / 2, cy: PADDING_PTS + rotH / 2 };
    case "center":
    default:
      return { cx: pageWidth / 2, cy: pageHeight / 2 };
  }
}

// Shrinks (w, h) uniformly until the rotated bbox fits in the page minus
// padding on every side. Returns the scale factor (≤ 1).
function fitScaleForRotated(
  w: number,
  h: number,
  angleDeg: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const { width: rotW, height: rotH } = rotatedBboxSize(w, h, angleDeg);
  const maxW = Math.max(1, pageWidth - PADDING_PTS * 2);
  const maxH = Math.max(1, pageHeight - PADDING_PTS * 2);

  return Math.min(1, maxW / rotW, maxH / rotH);
}

// ---------------------------------------------------------------------------
// Font cache for watermark text (avoids re-embedding per page)
// ---------------------------------------------------------------------------

let cachedFont: { font: PDFFont; key: string } | null = null;

async function getWatermarkFont(
  pdfDoc: PDFDocument,
  fontFamily: string,
): Promise<PDFFont> {
  const key = fontFamily;

  if (cachedFont && cachedFont.key === key) return cachedFont.font;

  const standardFont = resolveStandardFont(fontFamily, "normal", "normal");
  const font = await pdfDoc.embedFont(standardFont);

  cachedFont = { font, key };

  return font;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draws a watermark (text or image) onto a single PDF page.
 * Call this for each page that should have a watermark.
 */
export async function drawWatermarkOnPage(
  page: PDFPage,
  pdfDoc: PDFDocument,
  config: WatermarkConfig,
): Promise<void> {
  if (config.type === "text") {
    await drawTextWatermark(page, pdfDoc, config);
  } else if (config.type === "image" && config.imageData) {
    await drawImageWatermark(page, pdfDoc, config);
  }
}

/** Resets the internal font cache. Call between separate export operations. */
export function resetWatermarkFontCache(): void {
  cachedFont = null;
}

// ---------------------------------------------------------------------------
// Text watermark
// ---------------------------------------------------------------------------

async function drawTextWatermark(
  page: PDFPage,
  pdfDoc: PDFDocument,
  config: WatermarkConfig,
): Promise<void> {
  const font = await getWatermarkFont(pdfDoc, config.fontFamily);
  const { height: pageHeight, width: pageWidth } = page.getSize();

  const textWidth = font.widthOfTextAtSize(config.text, config.fontSize);
  // Use ascender-only height for positioning. heightAtSize() with the default
  // (includes descender) puts the visual cap-height center BELOW cy because
  // the descender region is empty for uppercase watermarks like "CONFIDENTIAL".
  // Ascender height (~cap height) makes the rendered glyphs sit visually
  // centered on cy.
  const textHeight = font.heightAtSize(config.fontSize, { descender: false });
  const color = hexToPdfColor(config.color);

  const drawOpts = {
    color: color ?? undefined,
    font,
    opacity: config.opacity,
    rotate: degrees(-config.rotation),
    size: config.fontSize,
  };

  if (config.position === "tiled") {
    const positions = calculateTilePositions(
      pageWidth,
      pageHeight,
      textWidth,
      textHeight,
      config.tiledSpacing,
    );

    for (const pos of positions) {
      // Tile positions use top-left origin; convert to PDF bottom-left
      page.drawText(config.text, {
        ...drawOpts,
        x: pos.x,
        y: pageHeight - pos.y - textHeight,
      });
    }
  } else {
    let effW = textWidth;
    let effH = textHeight;

    if (config.scaleToPage) {
      const maxWidth = pageWidth - PADDING_PTS * 2;
      const scale = Math.min(1, maxWidth / textWidth);

      effW *= scale;
      effH *= scale;
      drawOpts.size = config.fontSize * scale;
    }

    // Auto-fit: rotation can push the bbox past the page edge — shrink so the
    // rotated bbox stays inside the page minus PADDING_PTS on every side.
    const autoFit = fitScaleForRotated(
      effW,
      effH,
      config.rotation,
      pageWidth,
      pageHeight,
    );

    effW *= autoFit;
    effH *= autoFit;
    drawOpts.size *= autoFit;

    const { height: rotH } = rotatedBboxSize(effW, effH, config.rotation);
    const { cx, cy } = centerForPosition(
      config.position,
      pageWidth,
      pageHeight,
      rotH,
    );
    const { x, y } = pivotForCenter(cx, cy, effW, effH, config.rotation);

    page.drawText(config.text, { ...drawOpts, x, y });
  }
}

// ---------------------------------------------------------------------------
// Image watermark
// ---------------------------------------------------------------------------

async function drawImageWatermark(
  page: PDFPage,
  pdfDoc: PDFDocument,
  config: WatermarkConfig,
): Promise<void> {
  if (!config.imageData) return;

  const imageBytes = dataUrlToBytes(config.imageData);
  const isPng = config.imageData.includes("image/png");
  const image = isPng
    ? await pdfDoc.embedPng(imageBytes)
    : await pdfDoc.embedJpg(imageBytes);

  const { height: pageHeight, width: pageWidth } = page.getSize();
  const { height: imgH, width: imgW } = image.scale(1);

  let scale = 1;

  if (config.scaleToPage) {
    scale = Math.min(
      (pageWidth - PADDING_PTS * 2) / imgW,
      (pageHeight - PADDING_PTS * 2) / imgH,
      1,
    );
  }

  const scaledW = imgW * scale;
  const scaledH = imgH * scale;

  const drawOpts = {
    height: scaledH,
    opacity: config.opacity,
    rotate: degrees(-config.rotation),
    width: scaledW,
  };

  if (config.position === "tiled") {
    const positions = calculateTilePositions(
      pageWidth,
      pageHeight,
      scaledW,
      scaledH,
      config.tiledSpacing,
    );

    for (const pos of positions) {
      page.drawImage(image, {
        ...drawOpts,
        x: pos.x,
        y: pageHeight - pos.y - scaledH,
      });
    }
  } else {
    let effW = scaledW;
    let effH = scaledH;

    // Auto-fit so the rotated bbox stays inside the page minus PADDING_PTS.
    const autoFit = fitScaleForRotated(
      effW,
      effH,
      config.rotation,
      pageWidth,
      pageHeight,
    );

    effW *= autoFit;
    effH *= autoFit;
    drawOpts.width = effW;
    drawOpts.height = effH;

    const { height: rotH } = rotatedBboxSize(effW, effH, config.rotation);
    const { cx, cy } = centerForPosition(
      config.position,
      pageWidth,
      pageHeight,
      rotH,
    );
    const { x, y } = pivotForCenter(cx, cy, effW, effH, config.rotation);

    page.drawImage(image, { ...drawOpts, x, y });
  }
}
