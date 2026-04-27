import type { FabricObject } from "fabric";

export type ShapeFabricObject = FabricObject & {
  editorType?: string;
  linkUrl?: string;
  lockUniScaling?: boolean;
  shapeAspectLocked?: boolean;
};

type MaybeGroup = ShapeFabricObject & {
  getObjects?: () => ShapeFabricObject[];
};

const SHAPE_TYPES = new Set(["ellipse", "group", "line", "rect", "triangle"]);

export function isShapeObject(
  object: FabricObject | null | undefined,
): object is ShapeFabricObject {
  if (!object) return false;
  if (
    object.type === "i-text" ||
    object.type === "textbox" ||
    object.type === "text"
  ) {
    return false;
  }

  return SHAPE_TYPES.has(object.type ?? "");
}

function getGroupObjects(object: ShapeFabricObject): ShapeFabricObject[] {
  return (object as MaybeGroup).getObjects?.() ?? [];
}

export function applyShapeFill(object: ShapeFabricObject, fill: string) {
  if (object.type === "group" || object.type === "line") return;

  object.set("fill", fill);
}

export function applyShapeStroke(object: ShapeFabricObject, stroke: string) {
  object.set("stroke", stroke);

  for (const child of getGroupObjects(object)) {
    child.set("stroke", stroke);

    if (child.type === "triangle") {
      child.set("fill", stroke);
    }
  }
}

export function applyShapeStrokeWidth(
  object: ShapeFabricObject,
  strokeWidth: number,
) {
  object.set("strokeWidth", strokeWidth);

  for (const child of getGroupObjects(object)) {
    child.set("strokeWidth", strokeWidth);
  }
}

export function getShapeFill(object: ShapeFabricObject) {
  if (object.type === "group" || object.type === "line") return "transparent";

  return typeof object.fill === "string" ? object.fill : "transparent";
}

export function getShapeStroke(object: ShapeFabricObject) {
  if (typeof object.stroke === "string") return object.stroke;

  const childStroke = getGroupObjects(object).find(
    (child) => typeof child.stroke === "string",
  )?.stroke;

  return typeof childStroke === "string" ? childStroke : "#000000";
}

export function getShapeStrokeWidth(object: ShapeFabricObject) {
  const ownStrokeWidth = object.strokeWidth;

  if (typeof ownStrokeWidth === "number" && ownStrokeWidth > 0) {
    return ownStrokeWidth;
  }

  const childStrokeWidth = getGroupObjects(object).find(
    (child) => typeof child.strokeWidth === "number" && child.strokeWidth > 0,
  )?.strokeWidth;

  return typeof childStrokeWidth === "number" ? childStrokeWidth : 1;
}
