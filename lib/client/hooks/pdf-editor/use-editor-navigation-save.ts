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

      // Specialized routes (e.g. `/w-9-form`) own their own save
      // pipeline (`W9FinalizeIntercept` → finalize-then-upload) and set
      // `autoPersistDisabled` so this generic Fabric-merge save doesn't
      // upload the blank template on top of the stamped version as a
      // duplicate row (QA 2026-08-27). Fire the standalone
      // `editor:save` event so the W-9 intercept runs its own
      // finalize+upload in the background — the user's typed values +
      // signature land in the library even without clicking Done →
      // Download. The intercept surfaces its own toasts (loading /
      // success / error / sign-in prompt) so we don't stack any here.
      // Navigation continues immediately: the save fires as a
      // fire-and-forget from the caller's perspective, mirroring the
      // "hamburger Back on a normal PDF with no unsaved changes"
      // behavior — the row appears once the finalize returns.
      if (usePdfEditorStore.getState().autoPersistDisabled) {
        window.dispatchEvent(new CustomEvent("editor:save"));
        navigate();

        return;
      }

      isNavigatingRef.current = true;

      const loadingKey = toast.loading({
        title: "Saving…",
        description: "Saving your edits before you leave.",
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

        // Close the loading toast BEFORE surfacing the outcome — otherwise
        // the follow-up success/error toast stacks under "Saving…".
        toast.close(loadingKey);

        if (!result.ok) {
          // 2026-08-28: user report — "clicked Back, saw Saving toast, but
          // when I reopen the PDF nothing was saved." Root cause was that
          // every non-`ok` reason except `error` silently fell through to
          // `navigate()`, so a save that skipped because pdf.js was still
          // hydrating (`not-loaded`) — or because the store snapshot
          // disagreed with the caller's precondition check (`no-changes`,
          // `no-file`, `not-signed-in`) — left the user on the dashboard
          // convinced the edits were persisted. Surface each reason
          // explicitly and abort the navigation so the user can retry.
          if (result.reason === "error") {
            toast.error({
              title: "Could not save",
              description:
                "We couldn't save your PDF before leaving. Please try Save first.",
            });
          } else if (result.reason === "not-loaded") {
            toast.error({
              title: "Still loading",
              description:
                "The PDF is still loading — wait a moment, then try Back again.",
            });
          } else if (result.reason === "no-file") {
            // Truly no file → safe to navigate away, nothing to lose.
            navigate();
          } else if (result.reason === "not-signed-in") {
            toast.info({
              title: "Sign in to save",
              description: "Sign in to keep your edits in your library.",
            });
            navigate();
          } else if (result.reason === "no-changes") {
            // Store's own dirty flag disagreed with our earlier check
            // (raced during the async gap). Nothing to save → navigate.
            navigate();
          }

          return;
        }

        usePdfEditorStore
          .getState()
          .applyPostSaveReset(result.savedFile, result.remappedState);

        toast.success({
          title: "Saved",
          description: "Your edits were saved to your library.",
        });

        navigate();
      } catch (err) {
        toast.close(loadingKey);
        toast.error({
          title: "Could not save",
          description:
            "We couldn't save your PDF before leaving. Please try Save first.",
        });
        throw err;
      } finally {
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
      // Same specialized-route guard as `onNavigateAfterSave` above.
      if (usePdfEditorStore.getState().autoPersistDisabled) return;

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
