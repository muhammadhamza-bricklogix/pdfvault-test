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

export function useShapeTool({ fabricCanvas }: UseShapeToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const activeShapeType = usePdfEditorStore((s) => s.activeShapeType);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCreatingShape = usePdfEditorStore((s) => s.setIsCreatingShape);

  const classesRef = useRef<FabricClasses | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const tempShapeRef = useRef<FabricObject | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;
    if (activeTool !== "shape" && activeTool !== "eraser") return;

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

      const shapeType = activeTool === "eraser" ? "eraser" : activeShapeType;

      let shape: FabricObject;

      switch (shapeType) {
        case "rect":
          shape = new FRect({
            fill: "transparent",
            height: 0,
            left: pointer.x,
            stroke: "#000000",
            strokeUniform: true,
            strokeWidth: 2,
            top: pointer.y,
            width: 0,
          });
          break;

        case "ellipse":
          shape = new FEllipse({
            fill: "transparent",
            left: pointer.x,
            rx: 0,
            ry: 0,
            stroke: "#000000",
            strokeUniform: true,
            strokeWidth: 2,
            top: pointer.y,
          });
          break;

        case "line":
        case "arrow":
          shape = new FLine([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: "#000000",
            strokeLineCap: "round",
            strokeUniform: true,
            strokeWidth: 2,
          });
          break;

        case "eraser":
          shape = new FRect({
            fill: "#FFFFFF",
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

      const shapeType = activeTool === "eraser" ? "eraser" : activeShapeType;

      switch (shapeType) {
        case "rect":
        case "eraser":
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

      const shapeType = activeTool === "eraser" ? "eraser" : activeShapeType;

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
          stroke: "#000000",
          strokeLineCap: "round",
          strokeWidth: 2,
        });

        const arrowHead = new FTriangle({
          angle: angle + 90,
          fill: "#000000",
          height: headSize,
          left: endX,
          originX: "center",
          originY: "center",
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

      // Recalculate bounding box so the object is immediately grabbable
      finalShape.setCoords();
      fabricCanvas.setActiveObject(finalShape);
      tempShapeRef.current = null;

      // Arrow gets history from object:added (isCreatingShape is already false).
      // Non-arrow shapes were added during mousedown while isCreatingShape was
      // true, so we need a manual push here.
      if (shapeType !== "arrow") {
        pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
      }

      fabricCanvas.renderAll();
      setActiveTool("select");
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
    pushHistory,
    setActiveTool,
    setIsCreatingShape,
  ]);
}
