/**
 * Fingerprint helpers for the watermark + background-image configs.
 *
 * The save pipeline uses these to detect "this exact overlay was already baked
 * into the source PDF on the previous save". When the signature matches, the
 * merge skips re-applying the overlay — preventing the per-save stacking that
 * compounded a 30 %-opacity watermark to ~76 % after four round-trips and
 * turned every page jet-black.
 *
 * What IS included in the fingerprint: every field that changes the rendered
 * output (text, image bytes, color, opacity, position, rotation, page scope,
 * layer, scaleToPage, tiledSpacing, fontFamily/fontSize for text).
 *
 * What is NOT included: `enabled`. Toggling the Switch off and on without
 * editing anything else is NOT a config change — we want the fingerprint to
 * stay stable across that toggle so users don't accidentally re-bake.
 */
import type {
  BackgroundImageConfig,
  WatermarkConfig,
} from "@/lib/client/stores/pdf-editor-store";

export function watermarkSignature(config: WatermarkConfig): string {
  return JSON.stringify({
    text: config.text,
    type: config.type,
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    color: config.color,
    opacity: config.opacity,
    rotation: config.rotation,
    position: config.position,
    tiledSpacing: config.tiledSpacing,
    layer: config.layer,
    scaleToPage: config.scaleToPage,
    pageScope: config.pageScope,
    customPageRange: config.customPageRange,
    imageData: config.imageData,
  });
}

export function backgroundImageSignature(
  config: BackgroundImageConfig,
): string {
  return JSON.stringify({
    fit: config.fit,
    imageData: config.imageData,
    opacity: config.opacity,
    pageScope: config.pageScope,
    customPageRange: config.customPageRange,
  });
}
