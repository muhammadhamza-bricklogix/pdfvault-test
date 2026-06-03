"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

type NavigateAfterSaveDetail = {
  url: string;
};

/**
 * Saves the current document before in-app navigation (e.g. My PDFs).
 */
export function useEditorNavigationSave(fabricCanvas: FabricCanvas | null) {
  const router = useRouter();
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);

  const fabricRef = useRef(fabricCanvas);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    const onNavigateAfterSave = async (event: Event) => {
      const detail = (event as CustomEvent<NavigateAfterSaveDetail>).detail;

      if (!detail?.url || isNavigatingRef.current) return;

      if (!file) {
        router.push(detail.url);

        return;
      }

      if (!isSignedIn) {
        toast.info({
          title: "Sign in to save",
          description: "Sign in to keep your edits in your library.",
        });
        router.push(detail.url);

        return;
      }

      // Nothing to persist → skip the whole "Saving…" toast + upload roundtrip
      // and navigate immediately. Avoids the misleading flash users were
      // seeing on every back-to-library click even with no edits.
      if (!usePdfEditorStore.getState().hasUnsavedChanges) {
        router.push(detail.url);

        return;
      }

      isNavigatingRef.current = true;

      const loadingKey = toast.loading({
        title: "Saving…",
        description: "Saving your PDF before opening your library.",
      });

      try {
        const result = await persistEditorDocument({
          fabricCanvas: fabricRef.current,
        });

        if (!result.ok && result.reason === "error") {
          toast.error({
            title: "Could not save",
            description:
              "We couldn't save your PDF before leaving. Please try Save first.",
          });

          return;
        }

        router.push(detail.url);
      } finally {
        toast.close(loadingKey);
        isNavigatingRef.current = false;
      }
    };

    window.addEventListener("editor:navigate-after-save", onNavigateAfterSave);

    return () => {
      window.removeEventListener(
        "editor:navigate-after-save",
        onNavigateAfterSave,
      );
    };
  }, [file, isSignedIn, router]);

  useEffect(() => {
    const onPageHide = () => {
      if (!file || !isSignedIn || isNavigatingRef.current) return;

      void persistEditorDocument({ fabricCanvas: fabricRef.current });
    };

    // `pagehide` fires reliably on iOS Safari + Android Chrome on tab close
    // and navigation; `visibilitychange` does not. Keep both for redundancy.
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onPageHide();
    });

    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [file, isSignedIn]);

  // Browser warning when leaving with unsaved edits. We don't have a way to
  // hold the unload (async save can't complete during beforeunload), but we
  // can prompt the user so they don't lose work to an accidental close.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (usePdfEditorStore.getState().hasUnsavedChanges) {
        e.preventDefault();
        // Setting returnValue is the legacy way to trigger the prompt.
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
