/**
 * Utilities for converting Fabric.js path data to SVG path strings
 * suitable for pdf-lib's `page.drawSvgPath()`.
 */

type PathCommand = (number | string)[];

/**
 * Convert a Fabric.js path array to an SVG `d` attribute string.
 *
 * Fabric stores paths as arrays of commands:
 *   `[["M", 10, 20], ["C", 30, 40, 50, 60, 70, 80], ["L", 90, 100], ...]`
 *
 * This converts to: `"M 10 20 C 30 40 50 60 70 80 L 90 100"`
 */
export function fabricPathToSvgString(pathArray: PathCommand[]): string {
  return pathArray
    .map((cmd) => cmd.map((v) => (typeof v === "number" ? v : v)).join(" "))
    .join(" ");
}

/**
 * Apply scale + optional Y-flip to all numeric coordinates in a Fabric
 * path array. Returns a new array (does not mutate the original).
 *
 * Path commands alternate between a letter command and numeric coords.
 * The coordinates come in (x, y) pairs after the command letter.
 * This function scales x values by `scaleX` and y values by `scaleY`.
 * Pass a negative `scaleY` to flip the Y axis (for PDF coordinate space).
 *
 * Supported commands: M, L, C, Q, S, T, Z (uppercase only — Fabric uses absolute coords).
 */
export function transformPathCoords(
  pathArray: PathCommand[],
  scaleX: number,
  scaleY: number,
): PathCommand[] {
  return pathArray.map((cmd) => {
    const letter = cmd[0] as string;

    if (letter === "Z" || letter === "z") return [letter];

    const coords = cmd.slice(1) as number[];
    const transformed: (number | string)[] = [letter];

    for (let i = 0; i < coords.length; i += 2) {
      transformed.push(coords[i] * scaleX);

      if (i + 1 < coords.length) {
        transformed.push(coords[i + 1] * scaleY);
      }
    }

    return transformed;
  });
}

/**
 * Generate an SVG path string for an equilateral-ish triangle (used for arrowheads).
 *
 * Fabric's Triangle is drawn with its base at the bottom and apex at the top,
 * centered at (0, 0) in its local coordinate space. The vertices are:
 *   top:          (0, -height/2)
 *   bottom-left:  (-width/2, height/2)
 *   bottom-right: (width/2, height/2)
 */
export function triangleToSvgPath(width: number, height: number): string {
  const hw = width / 2;
  const hh = height / 2;

  return `M 0 ${-hh} L ${-hw} ${hh} L ${hw} ${hh} Z`;
}
