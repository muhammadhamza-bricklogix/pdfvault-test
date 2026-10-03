import type { RenderedPageInfo } from "../FormCanvas";
import type { FormField } from "@/lib/shared/types/forms.types";

export type FieldMode = "overlay" | "sidebar";

export type FieldProps = {
  field: FormField;
  mode: FieldMode;
  /** Provided only when mode === "overlay"; used to compute CSS px from PDF
   *  user-space coords. */
  page?: RenderedPageInfo;
};

export function pdfRectToCss(
  rect: { x: number; y: number; w: number; h: number },
  page: RenderedPageInfo,
) {
  const scale = page.displayWidth / page.pdfWidth;

  return {
    left: rect.x * scale,
    top: (page.pdfHeight - (rect.y + rect.h)) * scale,
    width: rect.w * scale,
    height: rect.h * scale,
    scale,
  };
}

/**
 * Overlay type size, in CSS px.
 *
 * The base size is expressed in PDF points and only then multiplied by the
 * page scale, so the text grows with the page at every zoom level. Clamping
 * in CSS px instead — as this used to — freezes the glyphs once the box
 * passes the ceiling while the page keeps growing, which is why 1099-NEC
 * text stopped scaling at ~130% zoom while the W-9's shorter boxes appeared
 * to keep up.
 *
 * `maxPt` keeps tall boxes (a 24pt name block, a 60pt radio group) from
 * rendering absurd type; `MIN_PX` keeps the text legible when zoomed out.
 */
const MIN_OVERLAY_PX = 8;

export function overlayFontSize(
  rect: { h: number },
  scale: number,
  { ratio = 1, maxPt = 15, override, allowOverflow = false }: OverlayFontOptions = {},
) {
  const basePt = override ?? Math.min(rect.h * ratio, maxPt);
  const px = Math.max(basePt * scale, MIN_OVERLAY_PX);

  // Inputs set `height: css.height` with `leading-none`, so a glyph taller
  // than its box is clipped. Fit-to-width bottoms out at 0.5 and the toolbar
  // allows 0.25, where the legibility floor alone would overflow a short box
  // — on a phone every 12pt field would clip.
  return allowOverflow ? px : Math.min(px, rect.h * scale);
}

type OverlayFontOptions = {
  /** Fraction of the box height the type should occupy. */
  ratio?: number;
  /** Ceiling in PDF points — scale-invariant, unlike a px ceiling. */
  maxPt?: number;
  /** Schema-pinned size in points, bypassing the box-height heuristic. */
  override?: number;
  /**
   * Centred single glyphs (the ✓) may spill past their box, as the old
   * fixed 11px mark did — an 8pt tick box is smaller than its own tick.
   * Text inputs may not.
   */
  allowOverflow?: boolean;
};
