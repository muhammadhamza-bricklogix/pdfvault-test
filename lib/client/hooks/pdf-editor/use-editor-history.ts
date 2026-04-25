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
  const setIsRestoringHistory = usePdfEditorStore(
    (s) => s.setIsRestoringHistory,
  );

  const [, forceRender] = useState(0);

  // Push initial baseline snapshot when canvas mounts (if no history exists yet)
  useEffect(() => {
    const fc = fabricRef.current;

    if (!fc) return;

    const existing = historyByPage.get(currentPage);

    if (!existing || existing.length === 0) {
      pushHistory(currentPage, JSON.stringify(fc.toJSON()));
    }
    // Only run when canvas mounts/changes — not on every historyByPage change
  }, [fabricCanvas, currentPage]);

  // Register fabric event listeners whenever the canvas mounts
  useEffect(() => {
    const fc = fabricRef.current;

    if (!fc) return;

    const snapshot = () => {
      const state = usePdfEditorStore.getState();

      if (state.isCreatingShape || state.isRestoringHistory) return;

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

    setIsRestoringHistory(true);
    try {
      await fc.loadFromJSON(JSON.parse(snapshot));
      fc.renderAll();
    } finally {
      setIsRestoringHistory(false);
    }

    forceRender((n) => n + 1);
  }, [canUndo, currentPage, fabricRef, undoStore, setIsRestoringHistory]);

  const redo = useCallback(async () => {
    const fc = fabricRef.current;

    if (!fc || !canRedo) return;

    const snapshot = redoStore(currentPage);

    if (!snapshot) return;

    setIsRestoringHistory(true);
    try {
      await fc.loadFromJSON(JSON.parse(snapshot));
      fc.renderAll();
    } finally {
      setIsRestoringHistory(false);
    }

    forceRender((n) => n + 1);
  }, [canRedo, currentPage, fabricRef, redoStore, setIsRestoringHistory]);

  return { canRedo, canUndo, redo, undo };
}
