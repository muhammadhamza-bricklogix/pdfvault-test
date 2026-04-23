"use client";

import type { Canvas } from "fabric";

import { useCallback, useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type UseSignatureToolParams = {
  fabricCanvas: Canvas | null;
};

export function useSignatureTool({ fabricCanvas }: UseSignatureToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsSignatureModalOpen = usePdfEditorStore(
    (s) => s.setIsSignatureModalOpen,
  );

  useEffect(() => {
    if (activeTool === "signature") {
      setIsSignatureModalOpen(true);
    }
  }, [activeTool, setIsSignatureModalOpen]);

  const handleModalClose = useCallback(() => {
    setIsSignatureModalOpen(false);
    setActiveTool("select");
  }, [setActiveTool, setIsSignatureModalOpen]);

  return { fabricCanvas, handleModalClose };
}
