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

      isNavigatingRef.current = true;

      const result = await persistEditorDocument({
        fabricCanvas: fabricRef.current,
      });

      isNavigatingRef.current = false;

      if (!result.ok && result.reason === "error") {
        toast.error({
          title: "Could not save",
          description:
            "We couldn't save your PDF before leaving. Please try Save first.",
        });

        return;
      }

      router.push(detail.url);
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
      if (document.visibilityState !== "hidden") return;
      if (!file || !isSignedIn || isNavigatingRef.current) return;

      void persistEditorDocument({ fabricCanvas: fabricRef.current });
    };

    document.addEventListener("visibilitychange", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onPageHide);
    };
  }, [file, isSignedIn]);
}
