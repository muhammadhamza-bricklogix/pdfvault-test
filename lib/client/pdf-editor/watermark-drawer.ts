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
import { dataUrlToBytes } from "./save-utils";
import { calculateTilePositions } from "./watermark-utils";

// ---------------------------------------------------------------------------
// Position resolver (PDF coordinates — origin bottom-left, Y up)
// ---------------------------------------------------------------------------

const PADDING_PTS = 40; // padding from page edges in PDF points

function resolveWatermarkPosition(
  position: string,
  pageWidth: number,
  pageHeight: number,
  elementWidth: number,
  elementHeight: number,
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return {
        x: PADDING_PTS,
        y: pageHeight - PADDING_PTS - elementHeight,
      };
    case "top-right":
      return {
        x: pageWidth - PADDING_PTS - elementWidth,
        y: pageHeight - PADDING_PTS - elementHeight,
      };
    case "bottom-left":
      return {
        x: PADDING_PTS,
        y: PADDING_PTS,
      };
    case "bottom-right":
      return {
        x: pageWidth - PADDING_PTS - elementWidth,
        y: PADDING_PTS,
      };
    case "center":
    default:
      return {
        x: (pageWidth - elementWidth) / 2,
        y: (pageHeight - elementHeight) / 2,
      };
  }
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
  const textHeight = font.heightAtSize(config.fontSize);
  const color = hexToPdfColor(config.color);

  const drawOpts = {
    color: color ?? undefined,
    font,
    opacity: config.opacity,
    rotate: degrees(config.rotation),
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
    let effectiveWidth = textWidth;
    let effectiveHeight = textHeight;

    if (config.scaleToPage) {
      const maxWidth = pageWidth - PADDING_PTS * 2;
      const scale = Math.min(1, maxWidth / textWidth);

      effectiveWidth *= scale;
      effectiveHeight *= scale;
      drawOpts.size = config.fontSize * scale;
    }

    const { x, y } = resolveWatermarkPosition(
      config.position,
      pageWidth,
      pageHeight,
      effectiveWidth,
      effectiveHeight,
    );

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
    rotate: degrees(config.rotation),
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
    const { x, y } = resolveWatermarkPosition(
      config.position,
      pageWidth,
      pageHeight,
      scaledW,
      scaledH,
    );

    page.drawImage(image, { ...drawOpts, x, y });
  }
}
