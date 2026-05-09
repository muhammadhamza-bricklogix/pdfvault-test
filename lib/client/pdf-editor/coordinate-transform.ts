/**
 * Coordinate transform utilities for converting Fabric.js canvas coordinates
 * to PDF page coordinates (pdf-lib).
 *
 * Fabric.js: origin at top-left, Y increases downward, units in CSS pixels.
 * PDF (pdf-lib): origin at bottom-left, Y increases upward, units in points (1/72 inch).
 */

export type CoordinateContext = {
  fabricHeight: number;
  fabricWidth: number;
  pdfHeight: number;
  pdfWidth: number;
  scaleX: number;
  scaleY: number;
};

export function createCoordinateContext(
  fabricWidth: number,
  fabricHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): CoordinateContext {
  return {
    fabricHeight,
    fabricWidth,
    pdfHeight,
    pdfWidth,
    scaleX: pdfWidth / fabricWidth,
    scaleY: pdfHeight / fabricHeight,
  };
}

/** Convert a Fabric X position to PDF X. */
export function toPdfX(fabricX: number, ctx: CoordinateContext): number {
  return fabricX * ctx.scaleX;
}

/**
 * Convert a Fabric Y position (top-left origin) to PDF Y (bottom-left origin).
 * `fabricObjHeight` is the rendered height of the object in Fabric units —
 * needed because Fabric positions objects from their top-left corner, while
 * PDF positions rectangles/ellipses from their bottom-left corner.
 */
export function toPdfY(
  fabricY: number,
  fabricObjHeight: number,
  ctx: CoordinateContext,
): number {
  return ctx.pdfHeight - fabricY * ctx.scaleY - fabricObjHeight * ctx.scaleY;
}

/**
 * Convert a Fabric Y position to a PDF Y baseline position for text.
 * pdf-lib's `drawText` positions text from the baseline, not the top.
 * `ascent` is the font ascent in Fabric units (approximately fontSize).
 */
export function toPdfTextY(
  fabricTop: number,
  ascent: number,
  ctx: CoordinateContext,
): number {
  return ctx.pdfHeight - (fabricTop + ascent) * ctx.scaleY;
}

/** Scale a Fabric dimension (width, height, radius, etc.) to PDF units. */
export function toPdfDim(fabricDim: number, scale: number): number {
  return fabricDim * scale;
}
