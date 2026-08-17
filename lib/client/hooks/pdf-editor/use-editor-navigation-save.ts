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
        // Match the Save-button flow (`useSaveEditor`): `force: true` so
        // any edit path that didn't flip `hasUnsavedChanges` still hits
        // the backend upsert, and `applyPostSaveReset` swaps the local
        // file to the just-uploaded merged bytes.
        //
        // Without `applyPostSaveReset` the store keeps the ORIGINAL
        // upload as `file` while `fabricJsonByPage` retains its
        // freshly-pristined overlay entries. Next time the same doc
        // opens (dashboard → click), `useEditorDocumentLoader` sees
        // `file != null && currentDocumentId === id` and short-circuits
        // → no refetch → the on-disk state and the store diverge.
        // Reported 2026-07-23 QA: "draw → My PDFs → save happens but
        // no version history entry." Making nav-save mirror Save-button
        // ensures every save path is fed identical inputs to the
        // backend snapshot logic.
        const result = await persistEditorDocument({
          fabricCanvas: fabricRef.current,
          force: true,
        });

        if (!result.ok && result.reason === "error") {
          toast.error({
            title: "Could not save",
            description:
              "We couldn't save your PDF before leaving. Please try Save first.",
          });

          return;
        }

        if (result.ok) {
          usePdfEditorStore
            .getState()
            .applyPostSaveReset(result.savedFile, result.remappedState);
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
}
