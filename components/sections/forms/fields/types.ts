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
  };
}
