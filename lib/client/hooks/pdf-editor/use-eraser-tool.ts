"use client";

import type { Canvas, TPointerEventInfo } from "fabric";

import { useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type UseEraserToolParams = {
  fabricCanvas: Canvas | null;
};

export function useEraserTool({ fabricCanvas }: UseEraserToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "eraser") return;

    // Disable object selection — clicks should delete, not select.
    // eslint-disable-next-line react-hooks/immutability -- Fabric canvas API mutates by design.
    fabricCanvas.selection = false;

    const onMouseDown = (opt: TPointerEventInfo) => {
      const target = opt.target;

      if (!target) return;

      fabricCanvas.remove(target);
      fabricCanvas.discardActiveObject();
      pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
      fabricCanvas.renderAll();
    };

    fabricCanvas.on("mouse:down", onMouseDown);

    return () => {
      fabricCanvas.off("mouse:down", onMouseDown);
      // Restore selection so the rubber-band works again in the select tool.

      fabricCanvas.selection = true;
    };
  }, [activeTool, currentPage, fabricCanvas, pushHistory]);
}
