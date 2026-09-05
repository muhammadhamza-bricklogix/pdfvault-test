"use client";

import type {
  Canvas,
  Ellipse,
  FabricObject,
  Group,
  Line,
  Rect,
  TPointerEventInfo,
  Triangle,
} from "fabric";

import { useEffect, useRef } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseShapeToolParams = {
  fabricCanvas: Canvas | null;
};

type FabricClasses = {
  Ellipse: typeof Ellipse;
  Group: typeof Group;
  Line: typeof Line;
  Rect: typeof Rect;
  Triangle: typeof Triangle;
};

// Fabric's canvas API is mutation-based by design. Hoisted so the tool
// hook can flip target hit-testing without tripping react-hooks/immutability
// on direct `fabricCanvas.x = y` assignments inside the effect.
function setSkipTargetFind(canvas: Canvas, skip: boolean): void {
  (canvas as unknown as { skipTargetFind: boolean }).skipTargetFind = skip;
}

export function useShapeTool({ fabricCanvas }: UseShapeToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const activeShapeType = usePdfEditorStore((s) => s.activeShapeType);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);
  const shapeFill = usePdfEditorStore((s) => s.shapeFill);
  const shapeStroke = usePdfEditorStore((s) => s.shapeStroke);
  const shapeStrokeWidth = usePdfEditorStore((s) => s.shapeStrokeWidth);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCreatingShape = usePdfEditorStore((s) => s.setIsCreatingShape);

  const classesRef = useRef<FabricClasses | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const tempShapeRef = useRef<FabricObject | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;
    if (
      activeTool !== "shape" &&
      activeTool !== "whiteout" &&
      activeTool !== "redact"
    )
      return;

    // With `fc.selection = false` alone, Fabric still hit-tests individual
    // objects on mouse:down and starts dragging any evented object under
    // the pointer. That produces two user-visible bugs on pages with
    // existing edits (highlights, IText, shapes): (1) clicking near an
    // existing edit picks it up and it follows the cursor, which reads as
    // "freehand redact"; (2) the same drag shifts the underlying edit.
    // `skipTargetFind = true` tells Fabric to skip target lookup entirely
    // so every click falls through to onMouseDown below and a fresh shape
    // is drawn start→end. Restored on cleanup so Select / Edit Text can
    // grab objects again.
    setSkipTargetFind(fabricCanvas, true);

    let cancelled = false;

    const preload = async () => {
      const mod = await import("fabric");

      if (cancelled) return;
      classesRef.current = {
        Ellipse: mod.Ellipse,
        Group: mod.Group,
        Line: mod.Line,
        Rect: mod.Rect,
        Triangle: mod.Triangle,
      };
    };

    const onMouseDown = (opt: TPointerEventInfo) => {
      if (!classesRef.current) return;

      const pointer = fabricCanvas.getScenePoint(opt.e);
      const {
        Ellipse: FEllipse,
        Line: FLine,
        Rect: FRect,
      } = classesRef.current;

      startRef.current = { x: pointer.x, y: pointer.y };
      draggingRef.current = true;
      setIsCreatingShape(true);

      const shapeType =
        activeTool === "whiteout"
          ? "whiteout"
          : activeTool === "redact"
            ? "redact"
            : activeShapeType;

      let shape: FabricObject;

      switch (shapeType) {
        case "rect":
          shape = new FRect({
            fill: shapeFill,
            height: 0,
            left: pointer.x,
            stroke: shapeStroke,
            strokeUniform: true,
            strokeWidth: shapeStrokeWidth,
            top: pointer.y,
            width: 0,
          });
          break;

        case "ellipse":
          shape = new FEllipse({
            fill: shapeFill,
            left: pointer.x,
            rx: 0,
            ry: 0,
            stroke: shapeStroke,
            strokeUniform: true,
            strokeWidth: shapeStrokeWidth,
            top: pointer.y,
          });
          break;

        case "line":
        case "arrow":
          shape = new FLine([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: shapeStroke,
            strokeLineCap: "round",
            strokeUniform: true,
            strokeWidth: shapeStrokeWidth,
          });
          break;

        case "whiteout":
          shape = new FRect({
            editorType: "whiteout",
            fill: "#FFFFFF",
            height: 0,
            left: pointer.x,
            stroke: "transparent",
            strokeWidth: 0,
            top: pointer.y,
            width: 0,
          });
          break;

        case "redact":
          // Redaction: solid black rectangle on top of the rasterized page.
          // The merge pipeline already renders the source page WITHOUT text
          // (suppressText: true in renderPageToPng), so the glyphs underneath
          // are gone in the saved bytes — this isn't a visual cover-up, it's
          // genuine permanent removal.
          shape = new FRect({
            editorType: "redaction",
            fill: "#000000",
            height: 0,
            left: pointer.x,
            stroke: "transparent",
            strokeWidth: 0,
            top: pointer.y,
            width: 0,
          });
          break;

        default:
          return;
      }

      shape.selectable = false;
      shape.evented = false;
      tempShapeRef.current = shape;
      fabricCanvas.add(shape);
      fabricCanvas.renderAll();
    };

    const onMouseMove = (opt: TPointerEventInfo) => {
      if (!draggingRef.current || !tempShapeRef.current) return;

      const pointer = fabricCanvas.getScenePoint(opt.e);
      const { x: sx, y: sy } = startRef.current;
      const dx = pointer.x - sx;
      const dy = pointer.y - sy;

      const shapeType =
        activeTool === "whiteout"
          ? "whiteout"
          : activeTool === "redact"
            ? "redact"
            : activeShapeType;

      switch (shapeType) {
        case "rect":
        case "whiteout":
        case "redact":
          tempShapeRef.current.set({
            height: Math.abs(dy),
            left: Math.min(sx, pointer.x),
            top: Math.min(sy, pointer.y),
            width: Math.abs(dx),
          });
          break;

        case "ellipse":
          tempShapeRef.current.set({
            left: Math.min(sx, pointer.x),
            rx: Math.abs(dx) / 2,
            ry: Math.abs(dy) / 2,
            top: Math.min(sy, pointer.y),
          });
          break;

        case "line":
        case "arrow":
          tempShapeRef.current.set({ x2: pointer.x, y2: pointer.y });
          break;
      }

      fabricCanvas.renderAll();
    };

    const onMouseUp = (opt: TPointerEventInfo) => {
      if (!draggingRef.current || !tempShapeRef.current || !classesRef.current)
        return;

      draggingRef.current = false;
      setIsCreatingShape(false);

      const pointer = fabricCanvas.getScenePoint(opt.e);
      const { x: sx, y: sy } = startRef.current;
      const dx = Math.abs(pointer.x - sx);
      const dy = Math.abs(pointer.y - sy);

      // Discard too-small shapes
      if (dx < 2 && dy < 2) {
        fabricCanvas.remove(tempShapeRef.current);
        tempShapeRef.current = null;
        fabricCanvas.renderAll();

        return;
      }

      const shapeType =
        activeTool === "whiteout"
          ? "whiteout"
          : activeTool === "redact"
            ? "redact"
            : activeShapeType;

      let finalShape: FabricObject;

      if (shapeType === "arrow") {
        // Replace temp line with a Group(Line + Triangle arrowhead)
        const {
          Group: FGroup,
          Line: FLine,
          Triangle: FTriangle,
        } = classesRef.current;
        const endX = pointer.x;
        const endY = pointer.y;
        const angle = Math.atan2(endY - sy, endX - sx) * (180 / Math.PI);
        const headSize = 12;

        fabricCanvas.remove(tempShapeRef.current);

        const arrowLine = new FLine([sx, sy, endX, endY], {
          stroke: shapeStroke,
          strokeLineCap: "round",
          strokeUniform: true,
          strokeWidth: shapeStrokeWidth,
        });

        const arrowHead = new FTriangle({
          angle: angle + 90,
          fill: shapeStroke,
          height: headSize,
          left: endX,
          originX: "center",
          originY: "center",
          stroke: shapeStroke,
          strokeUniform: true,
          strokeWidth: shapeStrokeWidth,
          top: endY,
          width: headSize,
        });

        const arrow = new FGroup([arrowLine, arrowHead]);

        fabricCanvas.add(arrow);
        finalShape = arrow;
      } else {
        // Make the temp shape interactive
        tempShapeRef.current.set({
          evented: true,
          selectable: true,
        });
        finalShape = tempShapeRef.current;
      }

      // Recalculate bounding box so the object is registered with Fabric
      // at its final position — needed for hit-testing later when the
      // user switches to Select and clicks the shape.
      finalShape.setCoords();
      // Deliberately do NOT `setActiveObject(finalShape)` here. QA
      // 2026-09-06: tool stays active for repeat draws (Shape /
      // Whiteout / Redact), so leaving the just-drawn shape as active
      // would show its selection handles during the NEXT drag —
      // `skipTargetFind` is on and Fabric can't discover the new
      // pointer target, so the old handles linger until the next
      // shape lands. Discarding here keeps the canvas visually clean
      // between draws.
      fabricCanvas.discardActiveObject();
      tempShapeRef.current = null;

      // Arrow gets history from object:added (isCreatingShape is already false).
      // Non-arrow shapes were added during mousedown while isCreatingShape was
      // true, so we need a manual push here. The history-hook's object:added
      // listener was also gated by isCreatingShape, so the dirty flag never
      // flipped for those shapes — mark dirty explicitly to match.
      if (shapeType !== "arrow") {
        pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
        markDocumentDirty();
      }

      // Persist synchronously so save/export can't miss the shape if the
      // flush at export time hits a stale/empty live canvas (matches the
      // 2026-07-23 draw/signature persistence pattern).
      saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));

      fabricCanvas.renderAll();
      // Tool intentionally NOT reset to "select" per QA 2026-09-06 —
      // Shape / Whiteout / Redact stay active so the user can draw
      // multiple shapes in a row without re-selecting the tool. The
      // Select tool on the toolbar is the explicit exit. Same rationale
      // applied to `use-draw-tool.ts`.
    };

    preload();
    fabricCanvas.on("mouse:down", onMouseDown);
    fabricCanvas.on("mouse:move", onMouseMove);
    fabricCanvas.on("mouse:up", onMouseUp);

    return () => {
      cancelled = true;
      fabricCanvas.off("mouse:down", onMouseDown);
      fabricCanvas.off("mouse:move", onMouseMove);
      fabricCanvas.off("mouse:up", onMouseUp);

      // Restore hit-testing so Select / Edit Text can grab objects again.
      setSkipTargetFind(fabricCanvas, false);

      // Clean up if unmounted mid-drag
      if (draggingRef.current && tempShapeRef.current) {
        fabricCanvas.remove(tempShapeRef.current);
        tempShapeRef.current = null;
        draggingRef.current = false;
        setIsCreatingShape(false);
      }
    };
  }, [
    activeShapeType,
    activeTool,
    currentPage,
    fabricCanvas,
    markDocumentDirty,
    pushHistory,
    saveFabricJson,
    shapeFill,
    shapeStroke,
    shapeStrokeWidth,
    setActiveTool,
    setIsCreatingShape,
  ]);
}
