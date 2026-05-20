/**
 * Shared watermark utilities used by both the Fabric.js preview (canvas) and
 * the pdf-lib export pipeline (PDF generation).
 */

/**
 * Parses a user-entered page range string (e.g. "1-3, 5, 7-12") into a set of
 * 1-indexed page numbers, clamped to the valid range [1, pageCount].
 */
export function parsePageRange(
  rangeStr: string,
  pageCount: number,
): Set<number> {
  const pages = new Set<number>();
  const parts = rangeStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr!, 10));
      const end = Math.min(pageCount, parseInt(endStr!, 10));

      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) pages.add(i);
      }
    } else {
      const num = parseInt(part, 10);

      if (!isNaN(num) && num >= 1 && num <= pageCount) pages.add(num);
    }
  }

  return pages;
}

/**
 * Determines whether a specific page (1-indexed) should receive a watermark
 * based on the current scope configuration.
 */
export function shouldWatermarkPage(
  pageNum: number,
  pageCount: number,
  pageScope: "all" | "custom" | "even" | "odd",
  customPageRange: string,
): boolean {
  switch (pageScope) {
    case "all":
      return true;
    case "odd":
      return pageNum % 2 === 1;
    case "even":
      return pageNum % 2 === 0;
    case "custom":
      return parsePageRange(customPageRange, pageCount).has(pageNum);
  }
}

/**
 * Calculates grid positions for a tiled (repeated) watermark across a page.
 * Returns an array of {x, y} positions for the top-left corner of each tile.
 * The grid is centered on the page.
 */
export function calculateTilePositions(
  pageWidth: number,
  pageHeight: number,
  elementWidth: number,
  elementHeight: number,
  spacing: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const cellWidth = elementWidth + spacing;
  const cellHeight = elementHeight + spacing;

  if (cellWidth <= 0 || cellHeight <= 0) return positions;

  const cols = Math.ceil(pageWidth / cellWidth) + 1;
  const rows = Math.ceil(pageHeight / cellHeight) + 1;
  const totalGridWidth = cols * cellWidth;
  const totalGridHeight = rows * cellHeight;
  const offsetX = (pageWidth - totalGridWidth) / 2 + spacing / 2;
  const offsetY = (pageHeight - totalGridHeight) / 2 + spacing / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: offsetX + col * cellWidth,
        y: offsetY + row * cellHeight,
      });
    }
  }

  return positions;
}
