"use client";

import type { Canvas } from "fabric";

import { useEffect } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseDrawToolParams = {
  fabricCanvas: Canvas | null;
};

export function useDrawTool({ fabricCanvas }: UseDrawToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "draw") return;

    let cancelled = false;

    const setup = async () => {
      const { PencilBrush } = await import("fabric");

      if (cancelled) return;

      // Fabric API requires passing the canvas to PencilBrush and mutating
      // the canvas's drawing flags directly — by design, not a React state
      // concern. Suppressing react-hooks/immutability for this block.
      /* eslint-disable react-hooks/immutability */
      const brush = new PencilBrush(fabricCanvas);

      brush.color = "#000000";
      brush.width = 2;
      brush.strokeLineCap = "round";
      brush.strokeLineJoin = "round";

      fabricCanvas.freeDrawingBrush = brush;
      fabricCanvas.isDrawingMode = true;
      /* eslint-enable react-hooks/immutability */
    };

    const onPathCreated = () => {
      // Persist the new path into the store immediately so the save pipeline
      // always sees it, even if the dirty-flag listener is skipped for any
      // reason (reported 2026-07-23: draw strokes missing from saved versions).
      if (fabricCanvas) {
        saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
        markDocumentDirty();
      }
      setActiveTool("select");
    };

    setup();
    fabricCanvas.on("path:created", onPathCreated);

    return () => {
      cancelled = true;
      fabricCanvas.off("path:created", onPathCreated);

      if (fabricCanvas.isDrawingMode) {
        fabricCanvas.isDrawingMode = false;
      }
    };
  }, [activeTool, fabricCanvas, setActiveTool]);
}
