"use client";

import type { Canvas } from "fabric";

import { useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

declare global {
  interface Window {
    __PDF_EDITOR_TEST__?: {
      fabricCanvas: Canvas | null;
      getStore: () => ReturnType<typeof usePdfEditorStore.getState>;
    };
  }
}

/**
 * Exposes the live Fabric canvas and Zustand store on `window` for E2E tests.
 * This hook is a no-op in production builds because the inner assignment is
 * guarded by `process.env.NODE_ENV === "development"` and will be dead-code
 * eliminated by the Next.js bundler.
 */
export function useTestHarness(fabricCanvas: Canvas | null) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    window.__PDF_EDITOR_TEST__ = {
      fabricCanvas,
      getStore: () => usePdfEditorStore.getState(),
    };
  }, [fabricCanvas]);
}
