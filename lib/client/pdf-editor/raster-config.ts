/**
 * Shared raster-scale policy for PDF rendering / export.
 *
 * - Screen rendering caps devicePixelRatio at 2 to keep canvas memory sane.
 * - Export rendering defaults to 3× but can be overridden by callers and is
 *   capped at 4× to prevent runaway memory / OOM on large documents.
 */

export const DEFAULT_EXPORT_RASTER_SCALE = 3;
export const MAX_EXPORT_RASTER_SCALE = 4;
export const MAX_SCREEN_DPR = 2;

/**
 * Returns a validated export raster scale.
 *
 * @param requested - Caller override (e.g. user preference). If omitted the
 *   default is returned.
 */
export function getExportRasterScale(requested?: number): number {
  if (requested === undefined) return DEFAULT_EXPORT_RASTER_SCALE;

  return Math.max(1, Math.min(requested, MAX_EXPORT_RASTER_SCALE));
}

/**
 * Returns a capped device-pixel ratio for on-screen canvas rendering.
 */
export function getScreenDpr(dpr?: number): number {
  return Math.min(
    dpr ?? (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1),
    MAX_SCREEN_DPR,
  );
}
