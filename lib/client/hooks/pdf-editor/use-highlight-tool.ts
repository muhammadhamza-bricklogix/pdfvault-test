"use client";

import type { Canvas, FabricObject } from "fabric";

import { useEffect } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseHighlightToolParams = {
  fabricCanvas: Canvas | null;
};

const MARKER_WIDTH = 20;
const MARKER_OPACITY = 0.4;

// PencilBrush draws in real-time onto the upper canvas via its `color` string,
// which is passed straight to canvas 2D `strokeStyle`. Using rgba here makes
// the marker translucent DURING the stroke, so the user sees the highlighter
// effect while dragging. On path:created we swap the object back to a plain
// hex `stroke` + `opacity` so the JSON survives the PDF export pipeline
// (`hexToPdfColor` only understands hex, and `drawPath` applies opacity separately).
function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useHighlightTool({ fabricCanvas }: UseHighlightToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const highlightColor = usePdfEditorStore((s) => s.highlightColor);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);
  const setIsCreatingShape = usePdfEditorStore((s) => s.setIsCreatingShape);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "highlight") return;

    let cancelled = false;

    const setup = async () => {
      const { PencilBrush } = await import("fabric");

      if (cancelled) return;

      // Fabric API requires passing the canvas to PencilBrush and mutating
      // drawing flags directly — by design, not a React state concern.
      /* eslint-disable react-hooks/immutability */
      const brush = new PencilBrush(fabricCanvas);

      brush.color = hexToRgba(highlightColor, MARKER_OPACITY);
      brush.width = MARKER_WIDTH;
      brush.strokeLineCap = "round";
      brush.strokeLineJoin = "round";
      // Shift held during stroke → straight line. Built into PencilBrush.
      brush.straightLineKey = "shiftKey";

      fabricCanvas.freeDrawingBrush = brush;
      fabricCanvas.isDrawingMode = true;
      /* eslint-enable react-hooks/immutability */
    };

    // Gate object:added history snapshot for freehand strokes so it doesn't
    // capture the path before we correct stroke + opacity in path:created.
    const onMouseDown = () => {
      setIsCreatingShape(true);
    };

    // PencilBrush fires path:created AFTER object:added. We reset the stroke
    // from rgba back to hex + set opacity so the export pipeline can handle it,
    // then push the corrected snapshot.
    const onPathCreated = (e: { path: FabricObject }) => {
      setIsCreatingShape(false);

      const path = e.path;

      if (path) {
        // PencilBrush copies its rgba color into both `stroke` and `fill`.
        // Reset stroke to hex + set opacity so `drawPath` (vector-drawers.ts)
        // reads it correctly at export. Clear fill so the path stays as a
        // stroke-only marker line (rgba `fill` would confuse `hexToPdfColor`).
        path.set({
          editorType: "highlight",
          fill: "",
          opacity: MARKER_OPACITY,
          stroke: highlightColor,
        });
        fabricCanvas.renderAll();
      }

      pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
      saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
      markDocumentDirty();
    };

    setup();
    fabricCanvas.on("mouse:down", onMouseDown);
    fabricCanvas.on("path:created", onPathCreated);

    return () => {
      cancelled = true;
      fabricCanvas.off("mouse:down", onMouseDown);
      fabricCanvas.off("path:created", onPathCreated);

      if (fabricCanvas.isDrawingMode) {
        fabricCanvas.isDrawingMode = false;
      }
      setIsCreatingShape(false);
    };
  }, [
    activeTool,
    currentPage,
    fabricCanvas,
    highlightColor,
    markDocumentDirty,
    pushHistory,
    saveFabricJson,
    setIsCreatingShape,
  ]);
}
