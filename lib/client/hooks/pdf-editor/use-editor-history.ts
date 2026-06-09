"use client";

import type { Canvas, FabricObject } from "fabric";
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
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
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

    // Dirty-tracking sibling of `snapshot`. Lives separately so we can skip
    // dirty marks for the IText overlays that `use-edit-text-mode` adds during
    // initial text extraction (those carry `editorType: "editModeText"` and
    // are NOT a user edit). `object:modified`, `object:removed`, and
    // `text:changed` always reflect user intent, so they pass through.
    const markDirtyOnAdd = (e: { target: FabricObject }) => {
      const state = usePdfEditorStore.getState();

      if (state.isCreatingShape || state.isRestoringHistory) return;
      const editorType = (e?.target as FabricObject & { editorType?: string })
        ?.editorType;

      if (editorType === "editModeText") return;
      markDocumentDirty();
    };

    const markDirtyOnEdit = () => {
      const state = usePdfEditorStore.getState();

      if (state.isCreatingShape || state.isRestoringHistory) return;
      markDocumentDirty();
    };

    fc.on("object:added", snapshot);
    fc.on("object:modified", snapshot);
    fc.on("object:removed", snapshot);
    fc.on("object:added", markDirtyOnAdd);
    fc.on("object:modified", markDirtyOnEdit);
    fc.on("object:removed", markDirtyOnEdit);
    fc.on("text:changed", markDirtyOnEdit);

    return () => {
      fc.off("object:added", snapshot);
      fc.off("object:modified", snapshot);
      fc.off("object:removed", snapshot);
      fc.off("object:added", markDirtyOnAdd);
      fc.off("object:modified", markDirtyOnEdit);
      fc.off("object:removed", markDirtyOnEdit);
      fc.off("text:changed", markDirtyOnEdit);
    };
  }, [fabricCanvas, currentPage, markDocumentDirty, pushHistory]);

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
