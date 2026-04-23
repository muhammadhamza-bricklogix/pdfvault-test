"use client";

import type { Canvas } from "fabric";

import { useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type UseDrawToolParams = {
  fabricCanvas: Canvas | null;
};

export function useDrawTool({ fabricCanvas }: UseDrawToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "draw") return;

    let cancelled = false;

    const setup = async () => {
      const { PencilBrush } = await import("fabric");

      if (cancelled) return;

      const brush = new PencilBrush(fabricCanvas);

      brush.color = "#000000";
      brush.width = 2;
      brush.strokeLineCap = "round";
      brush.strokeLineJoin = "round";

      fabricCanvas.freeDrawingBrush = brush;
      fabricCanvas.isDrawingMode = true;
    };

    const onPathCreated = () => {
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
