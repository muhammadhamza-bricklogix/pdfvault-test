import type { PageRotation } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

/**
 * Rotates every Fabric overlay object's position + angle so overlays stick
 * with the page content when a page is rotated via Manage Pages.
 *
 * Context: `append-pdf-page.ts` bakes rotation into the SOURCE page's content
 * stream (so the raw PDF content rotates correctly), but the Fabric overlay
 * layer stored in `fabricJsonByPage` keeps its pre-rotation (left, top,
 * angle). Without this remap, user-added text / shapes / signatures / images
 * / drawings / highlights / page-numbers stay oriented in the pre-rotation
 * coordinate space on top of post-rotation page content — QA 2026-10-04
 * row 6 ("existing text does not rotate correctly").
 *
 * Fabric's (left, top) is the object's PIVOT point in canvas coords regardless
 * of origin. For a page rotated clockwise around its visual centre, each
 * object's pivot transforms as:
 *   - 90° CW:  (x, y) → (oldH − y, x)                 (new dims: H × W)
 *   - 180°:    (x, y) → (oldW − x, oldH − y)          (new dims: W × H)
 *   - 270° CW: (x, y) → (y, oldW − x)                 (new dims: H × W)
 *
 * And the object's own `angle` is incremented by the rotation so the object's
 * local orientation also rotates with the page.
 */
export function rotateFabricJson(
  json: string,
  rotation: PageRotation,
  oldWidth: number,
  oldHeight: number,
): string {
  if (!rotation) return json;

  let parsed: { objects?: Array<Record<string, unknown>> };

  try {
    parsed = JSON.parse(json);
  } catch {
    return json;
  }

  if (!parsed || !Array.isArray(parsed.objects)) return json;

  const rotatePoint = (x: number, y: number): { x: number; y: number } => {
    switch (rotation) {
      case 90:
        return { x: oldHeight - y, y: x };
      case 180:
        return { x: oldWidth - x, y: oldHeight - y };
      case 270:
        return { x: y, y: oldWidth - x };
      default:
        return { x, y };
    }
  };

  parsed.objects = parsed.objects.map((obj) => {
    const left = typeof obj.left === "number" ? obj.left : 0;
    const top = typeof obj.top === "number" ? obj.top : 0;
    const angle = typeof obj.angle === "number" ? obj.angle : 0;
    const { x, y } = rotatePoint(left, top);

    return {
      ...obj,
      angle: (((angle + rotation) % 360) + 360) % 360,
      left: x,
      top: y,
    };
  });

  return JSON.stringify(parsed);
}
