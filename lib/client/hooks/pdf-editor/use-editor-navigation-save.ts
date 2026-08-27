"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

type NavigateAfterSaveDetail = {
  url: string;
  /**
   * When true, `clearFile()` runs after the save (or the early-bail) and
   * BEFORE `router.push(url)`. Used by the Back-to-dashboard buttons so
   * the next editor entry doesn't paint the previous PDF for a frame
   * while the new one loads (QA 2026-08-18). "My PDFs" leaves this
   * false because the store's file is fine to keep around while the
   * library opens in a fresh route.
   */
  clearFileAfter?: boolean;
};

// Module-level flag flipped by callers (e.g. ReloadConfirmModal) that
// intentionally trigger a full-page reload / navigation. The beforeunload
// handler below checks this so the browser's native "Leave site?" dialog
// doesn't appear on top of our own custom confirm — otherwise the user
// sees two prompts for the same action.
let suppressNextUnloadPrompt = false;

export function suppressNextUnload() {
  suppressNextUnloadPrompt = true;
  // Auto-clear after a short window in case the reload never happens (e.g.
  // the caller decided to cancel after all). Keeps the flag from silently
  // swallowing a genuine reload later in the session.
  window.setTimeout(() => {
    suppressNextUnloadPrompt = false;
  }, 5000);
}

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

      const clearFileAfter = detail.clearFileAfter === true;
      const navigate = () => {
        if (clearFileAfter) usePdfEditorStore.getState().clearFile();
        router.push(detail.url);
      };

      if (!file) {
        navigate();

        return;
      }

      if (!isSignedIn) {
        toast.info({
          title: "Sign in to save",
          description: "Sign in to keep your edits in your library.",
        });
        navigate();

        return;
      }

      // Nothing to persist → skip the whole "Saving…" toast + upload roundtrip
      // and navigate immediately. Avoids the misleading flash users were
      // seeing on every back-to-library click even with no edits.
      if (!usePdfEditorStore.getState().hasUnsavedChanges) {
        navigate();

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

        navigate();
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

  // Browser reload / tab-close guard. Chrome, Safari, Firefox strip any
  // custom text from `beforeunload` since ~2016 (anti-phishing), so we can
  // only trigger the browser's own generic "Leave site? Changes you made
  // may not be saved." dialog for reloads initiated from the browser's own
  // chrome (address bar reload button, Cmd+Shift+R hard reload). Keyboard
  // reloads (F5 / Cmd+R / Ctrl+R) are intercepted below with a custom
  // modal. The `pagehide` handler above still runs a best-effort
  // background save if the user confirms "Leave".
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (suppressNextUnloadPrompt) {
        suppressNextUnloadPrompt = false;

        return;
      }
      if (!usePdfEditorStore.getState().hasUnsavedChanges) return;
      if (isNavigatingRef.current) return;

      e.preventDefault();
      // Legacy Chrome/Safari require assigning `returnValue` to trigger
      // the dialog; the string itself is ignored.
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // Keyboard reload interception. Cmd+R (macOS), Ctrl+R (Windows/Linux),
  // and F5 all reach us as a `keydown` event before the browser's own
  // reload handler runs — `preventDefault` cancels the reload and we
  // open our own confirm modal via `editor:show-reload-prompt`. The
  // browser's reload BUTTON (in the address bar) does NOT fire keydown
  // and cannot be intercepted; those still get the native dialog above.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isReloadCombo =
        e.key === "F5" ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r");

      if (!isReloadCombo) return;
      if (!usePdfEditorStore.getState().hasUnsavedChanges) return;
      if (isNavigatingRef.current) return;

      e.preventDefault();
      window.dispatchEvent(new CustomEvent("editor:show-reload-prompt"));
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
