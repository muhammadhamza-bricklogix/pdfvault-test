"use client";

import type { Canvas, FabricObject, Rect, TPointerEventInfo } from "fabric";

import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type UseHighlightToolParams = {
  fabricCanvas: Canvas | null;
};

export function useHighlightTool({ fabricCanvas }: UseHighlightToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const highlightColor = usePdfEditorStore((s) => s.highlightColor);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCreatingShape = usePdfEditorStore((s) => s.setIsCreatingShape);

  const rectClassRef = useRef<typeof Rect | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const tempShapeRef = useRef<FabricObject | null>(null);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "highlight") return;

    let cancelled = false;

    const preload = async () => {
      const { Rect: FRect } = await import("fabric");

      if (cancelled) return;
      rectClassRef.current = FRect;
    };

    const onMouseDown = (opt: TPointerEventInfo) => {
      if (!rectClassRef.current) return;

      const pointer = fabricCanvas.getScenePoint(opt.e);
      const FRect = rectClassRef.current;

      startRef.current = { x: pointer.x, y: pointer.y };
      draggingRef.current = true;
      setIsCreatingShape(true);

      const shape = new FRect({
        editorType: "highlight",
        evented: false,
        fill: highlightColor,
        height: 0,
        left: pointer.x,
        opacity: 0.35,
        selectable: false,
        stroke: "transparent",
        strokeWidth: 0,
        top: pointer.y,
        width: 0,
      });

      tempShapeRef.current = shape;
      fabricCanvas.add(shape);
      fabricCanvas.renderAll();
    };

    const onMouseMove = (opt: TPointerEventInfo) => {
      if (!draggingRef.current || !tempShapeRef.current) return;

      const pointer = fabricCanvas.getScenePoint(opt.e);
      const { x: sx, y: sy } = startRef.current;

      tempShapeRef.current.set({
        height: Math.abs(pointer.y - sy),
        left: Math.min(sx, pointer.x),
        top: Math.min(sy, pointer.y),
        width: Math.abs(pointer.x - sx),
      });
      fabricCanvas.renderAll();
    };

    const onMouseUp = () => {
      if (!draggingRef.current || !tempShapeRef.current) return;

      draggingRef.current = false;
      setIsCreatingShape(false);

      const shape = tempShapeRef.current;
      const w = shape.width ?? 0;
      const h = shape.height ?? 0;

      // Discard too-small highlights
      if (w < 2 && h < 2) {
        fabricCanvas.remove(shape);
        tempShapeRef.current = null;
        fabricCanvas.renderAll();

        return;
      }

      shape.set({ evented: true, selectable: true });
      shape.setCoords();
      fabricCanvas.setActiveObject(shape);
      tempShapeRef.current = null;

      pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
      // object:added fired during mousedown was gated by isCreatingShape, so
      // mark dirty explicitly here now that the highlight is finalized.
      markDocumentDirty();
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

      if (draggingRef.current && tempShapeRef.current) {
        fabricCanvas.remove(tempShapeRef.current);
        tempShapeRef.current = null;
        draggingRef.current = false;
        setIsCreatingShape(false);
      }
    };
  }, [
    activeTool,
    currentPage,
    fabricCanvas,
    highlightColor,
    markDocumentDirty,
    pushHistory,
    setActiveTool,
    setIsCreatingShape,
  ]);
}
