"use client";

import type { Canvas } from "fabric";
import type { RefObject } from "react";

import { useCallback, useEffect, useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type UseEditorHistoryParams = {
  fabricCanvas: Canvas | null;
  fabricRef: RefObject<Canvas | null>;
};

export function useEditorHistory({
  fabricCanvas,
  fabricRef,
}: UseEditorHistoryParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const undoStore = usePdfEditorStore((s) => s.undo);
  const redoStore = usePdfEditorStore((s) => s.redo);

  const [, forceRender] = useState(0);

  // Register fabric event listeners whenever the canvas mounts
  useEffect(() => {
    const fc = fabricRef.current;

    if (!fc) return;

    const snapshot = () => {
      if (usePdfEditorStore.getState().isCreatingShape) return;

      const json = JSON.stringify(fc.toJSON());

      pushHistory(currentPage, json);
      forceRender((n) => n + 1);
    };

    fc.on("object:added", snapshot);
    fc.on("object:modified", snapshot);
    fc.on("object:removed", snapshot);

    return () => {
      fc.off("object:added", snapshot);
      fc.off("object:modified", snapshot);
      fc.off("object:removed", snapshot);
    };
  }, [fabricCanvas, currentPage, pushHistory]);

  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const history = historyByPage.get(currentPage) ?? [];
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

  const undo = useCallback(async () => {
    const fc = fabricRef.current;

    if (!fc || !canUndo) return;
    const snapshot = undoStore(currentPage);

    if (!snapshot) return;
    await fc.loadFromJSON(JSON.parse(snapshot));
    fc.renderAll();
    forceRender((n) => n + 1);
  }, [canUndo, currentPage, fabricRef, undoStore]);

  const redo = useCallback(async () => {
    const fc = fabricRef.current;

    if (!fc || !canRedo) return;
    const snapshot = redoStore(currentPage);

    if (!snapshot) return;
    await fc.loadFromJSON(JSON.parse(snapshot));
    fc.renderAll();
    forceRender((n) => n + 1);
  }, [canRedo, currentPage, fabricRef, redoStore]);

  return { canRedo, canUndo, redo, undo };
}
