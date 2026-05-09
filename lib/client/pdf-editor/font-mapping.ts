import type { PDFDocument, PDFFont } from "pdf-lib";

import { StandardFonts } from "pdf-lib";

type FontKey = `${string}|${string}|${string}`;

/**
 * Resolves a Fabric.js font family + weight + style to the closest pdf-lib
 * `StandardFonts` enum value.
 *
 * Standard mapping:
 *   Arial / Verdana  → Helvetica family
 *   Times New Roman / Georgia → Times-Roman family
 *   Courier New → Courier family
 *   Unknown → Helvetica (safe fallback)
 */
export function resolveStandardFont(
  fontFamily: string,
  fontWeight: string,
  fontStyle: string,
): StandardFonts {
  const isBold = fontWeight === "bold" || Number(fontWeight) >= 700;
  const isItalic = fontStyle === "italic";

  const family = fontFamily.toLowerCase().trim();

  // Serif families
  if (
    family.includes("times") ||
    family.includes("georgia") ||
    family.includes("serif")
  ) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;

    return StandardFonts.TimesRoman;
  }

  // Monospace families
  if (family.includes("courier") || family.includes("mono")) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;

    return StandardFonts.Courier;
  }

  // Sans-serif families (Arial, Verdana, Helvetica, or anything else)
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;

  return StandardFonts.Helvetica;
}

/**
 * Caches embedded `PDFFont` instances to avoid re-embedding the same
 * font multiple times into the PDF document.
 */
export class FontCache {
  private cache = new Map<FontKey, PDFFont>();
  private pdfDoc: PDFDocument;

  constructor(pdfDoc: PDFDocument) {
    this.pdfDoc = pdfDoc;
  }

  async getFont(
    fontFamily: string,
    fontWeight: string,
    fontStyle: string,
  ): Promise<PDFFont> {
    const key: FontKey = `${fontFamily}|${fontWeight}|${fontStyle}`;
    const cached = this.cache.get(key);

    if (cached) return cached;

    const standardFont = resolveStandardFont(fontFamily, fontWeight, fontStyle);
    const font = await this.pdfDoc.embedFont(standardFont);

    this.cache.set(key, font);

    return font;
  }
}
