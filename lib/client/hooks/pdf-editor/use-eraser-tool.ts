"use client";

import type { Canvas, FabricObject, TPointerEventInfo } from "fabric";

import { useEffect } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseEraserToolParams = {
  fabricCanvas: Canvas | null;
};

export function useEraserTool({ fabricCanvas }: UseEraserToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);

  useEffect(() => {
    if (!fabricCanvas || activeTool !== "eraser") return;

    // Disable object selection — clicks should delete, not select. Enable
    // hit-testing so single-object taps still populate `opt.target` even
    // though the rubber-band is off (QA report 2026-07-23: "eraser doesn't
    // work on web or mobile" — root cause was `selection = false` alone
    // sometimes leaves `opt.target` undefined in Fabric v7, so we also
    // fall back to `findTarget(e)` in the handler below).
    // eslint-disable-next-line react-hooks/immutability -- Fabric canvas API mutates by design.
    fabricCanvas.selection = false;

    fabricCanvas.skipTargetFind = false;

    const resolveTarget = (
      opt: TPointerEventInfo,
    ): FabricObject | undefined => {
      if (opt.target) return opt.target;

      // Fallback for Fabric v7 code paths where mouse:down's opt.target
      // isn't populated (typically with `selection = false`). Ask Fabric
      // directly what's under the pointer.
      const e = opt.e as Event | undefined;

      if (!e) return undefined;

      const findTarget = (
        fabricCanvas as unknown as {
          findTarget?: (e: Event) => FabricObject | undefined;
        }
      ).findTarget;

      return findTarget?.call(fabricCanvas, e) ?? undefined;
    };

    const erase = (opt: TPointerEventInfo) => {
      const target = resolveTarget(opt);

      if (!target) return;

      fabricCanvas.remove(target);
      fabricCanvas.discardActiveObject();
      pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
      // Persist the deletion into the store immediately so the save/export
      // pipeline sees it even if `flushLiveFabricPage` at export time hits
      // a mid-remount live canvas and can't reliably capture state.
      saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
      markDocumentDirty();
      fabricCanvas.requestRenderAll();
    };

    // `mouse:up` fires on tap-release, matching the user's mental model
    // for "click to erase" better than mouse:down (a mouse:down handler
    // sometimes fired before Fabric finished target detection on iOS
    // Safari touchstart, so the wrong object — or no object — was
    // removed).
    fabricCanvas.on("mouse:up", erase);

    return () => {
      fabricCanvas.off("mouse:up", erase);
      // Restore selection so the rubber-band works again in the select tool.

      fabricCanvas.selection = true;
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
