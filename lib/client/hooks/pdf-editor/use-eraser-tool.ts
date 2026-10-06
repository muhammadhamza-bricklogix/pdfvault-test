"use client";

import type { Canvas, FabricObject, TPointerEventInfo } from "fabric";

import { useEffect } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseEraserToolParams = {
  fabricCanvas: Canvas | null;
};

// Page content and tool-managed overlays the eraser must never remove.
const PROTECTED_EDITOR_TYPES = new Set([
  "editModeText",
  "pageNumber",
  "watermarkPreview",
]);

// Scene-space spacing between hit tests while dragging, so fast strokes
// don't skip over thin objects.
const DRAG_SAMPLE_STEP = 4;

type ScenePoint = { x: number; y: number };

function isErasable(obj: FabricObject): boolean {
  const editorType = (obj as { editorType?: string }).editorType;

  return !editorType || !PROTECTED_EDITOR_TYPES.has(editorType);
}

export function useEraserTool({ fabricCanvas }: UseEraserToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "eraser") return;

    // Hit-testing is done here (not by Fabric) so a tap or drag can't select
    // or move objects, and protected page text never shields a stroke.
    const prevDefaultCursor = fabricCanvas.defaultCursor;

    // eslint-disable-next-line react-hooks/immutability -- Fabric canvas API mutates by design.
    fabricCanvas.selection = false;
    fabricCanvas.skipTargetFind = true;
    fabricCanvas.defaultCursor = "crosshair";
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();

    let erasing = false;
    let removedAny = false;
    let lastPoint: ScenePoint | null = null;

    const scenePoint = (opt: TPointerEventInfo): ScenePoint | null => {
      if (opt.scenePoint) return { x: opt.scenePoint.x, y: opt.scenePoint.y };
      if (!opt.e) return null;
      const p = fabricCanvas.getScenePoint(opt.e);

      return { x: p.x, y: p.y };
    };

    const eraseAt = async (point: ScenePoint) => {
      const { Point } = await import("fabric");
      const scene = new Point(point.x, point.y);
      const objects = fabricCanvas.getObjects();

      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];

        if (!obj.visible || !isErasable(obj)) continue;
        if (!obj.containsPoint(scene)) continue;

        fabricCanvas.remove(obj);
        removedAny = true;

        return;
      }
    };

    const eraseAlong = async (from: ScenePoint, to: ScenePoint) => {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(dist / DRAG_SAMPLE_STEP));

      for (let i = 1; i <= steps; i++) {
        await eraseAt({
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        });
      }
      fabricCanvas.requestRenderAll();
    };

    const onDown = (opt: TPointerEventInfo) => {
      const point = scenePoint(opt);

      if (!point) return;
      erasing = true;
      removedAny = false;
      lastPoint = point;
      void eraseAt(point).then(() => fabricCanvas.requestRenderAll());
    };

    const onMove = (opt: TPointerEventInfo) => {
      if (!erasing || !lastPoint) return;
      const point = scenePoint(opt);

      if (!point) return;
      const from = lastPoint;

      lastPoint = point;
      void eraseAlong(from, point);
    };

    const onUp = (opt: TPointerEventInfo) => {
      if (!erasing) return;
      erasing = false;
      const point = scenePoint(opt);
      const from = lastPoint;

      lastPoint = null;
      void (async () => {
        if (point && from) await eraseAlong(from, point);
        if (!removedAny) return;
        removedAny = false;
        pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
        // Persist immediately so save/export see the deletion even if the
        // live canvas remounts before `flushLiveFabricPage` runs.
        saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
        markDocumentDirty();
        fabricCanvas.requestRenderAll();
      })();
    };

    fabricCanvas.on("mouse:down", onDown);
    fabricCanvas.on("mouse:move", onMove);
    fabricCanvas.on("mouse:up", onUp);

    return () => {
      fabricCanvas.off("mouse:down", onDown);
      fabricCanvas.off("mouse:move", onMove);
      fabricCanvas.off("mouse:up", onUp);
      // Restore selection so the rubber-band works again in the select tool.
      fabricCanvas.selection = true;
      fabricCanvas.skipTargetFind = false;
      fabricCanvas.defaultCursor = prevDefaultCursor;
    };
  }, [
    activeTool,
    currentPage,
    fabricCanvas,
    markDocumentDirty,
    pushHistory,
    saveFabricJson,
  ]);
}
