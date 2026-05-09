import type { Color } from "pdf-lib";

import { rgb } from "pdf-lib";

/**
 * Converts a hex color string (e.g. "#FF0000") to a pdf-lib `Color`.
 * Returns `null` for "transparent" or empty/invalid values — callers
 * should skip the fill/stroke when they receive null.
 */
export function hexToPdfColor(hex: string | undefined): Color | null {
  if (!hex || hex === "transparent") return null;

  const c = hex.replace("#", "");

  if (c.length !== 6) return null;

  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

  return rgb(r / 255, g / 255, b / 255);
}
