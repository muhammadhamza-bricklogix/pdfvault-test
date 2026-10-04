"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { flushLiveFabricPage } from "@/lib/client/pdf-editor/save-utils";
import { isDuplicatePromptOpen } from "@/lib/client/hooks/documents/duplicate-prompt-bus";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { logger } from "@/lib/shared/utils/logger";
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
  /**
   * Bypass the `!hasUnsavedChanges` short-circuit and always run the
   * cloud save (via `persistEditorDocument({ force: true })`). Set by
   * the logo click so a "quick draw → click logo" sequence, where the
   * live canvas has new strokes but `hasUnsavedChanges` may not have
   * propagated yet due to a listener race, still uploads the latest
   * state instead of navigating away silently (QA 2026-09-08).
   */
  force?: boolean;
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
        // Signed-out caller: no cloud doc to persist, but we still owe
        // the user their in-progress edits — snapshot the live canvas
        // into IDB via the pending-editor-file mirror so
        // `PendingEditorFileHydrator` can restore it if they come back
        // (QA 2026-09-08: clicked logo after drawing → lost edits).
        // Fire-and-forget with a short timeout so a slow IDB write
        // can't strand the user on the editor.
        try {
          await Promise.race([
            snapshotPendingEditorFile(fabricRef.current).catch(() => undefined),
            new Promise((r) => window.setTimeout(r, 2000)),
          ]);
        } catch {
          // best-effort — proceed with navigation regardless
        }
        // QA 2026-09-06 copy: "Sign in" → "Login".
        toast.info({
          title: "Login to save",
          description: "Login to keep your edits in your library.",
        });
        navigate();

        return;
      }

      // Nothing to persist → skip the whole "Saving…" toast + upload roundtrip
      // and navigate immediately. Avoids the misleading flash users were
      // seeing on every back-to-library click even with no edits.
      // `force: true` bypasses this so the logo-click (and any other
      // caller that sets force) always runs the save — protects against
      // a race where the last stroke's `path:created` listener hasn't
      // flipped `hasUnsavedChanges` yet when the user clicks away.
      if (!detail.force && !usePdfEditorStore.getState().hasUnsavedChanges) {
        navigate();

        return;
      }

      // Specialized routes (e.g. `/w-9-form`) own their own save
      // pipeline (`W9FinalizeIntercept` → finalize-then-upload) and set
      // `autoPersistDisabled` so this generic Fabric-merge save doesn't
      // upload the blank template on top of the stamped version as a
      // duplicate row (QA 2026-08-27). Dispatch the dedicated
      // `editor:w9-save-and-continue` event that the W-9 intercept
      // listens for — it runs finalize + upload with the w9 marker in
      // `editorState` and resolves `onComplete` when done, so the
      // navigation only fires AFTER the row is persisted. Backed by a
      // 30 s timeout so a hung finalize can't strand the user; on
      // timeout we navigate anyway (the save keeps running in
      // background and its own toast will surface the outcome).
      if (usePdfEditorStore.getState().autoPersistDisabled) {
        const w9LoadingKey = toast.loading({
          title: "Saving your form…",
          description: "Updating your form in My PDFs.",
        });

        const w9Result = await new Promise<{
          ok: boolean;
          reason?:
            | "error"
            | "not-signed-in"
            | "cancelled"
            | "cancelled-duplicate"
            | "not-ready";
        }>((resolve) => {
          // Re-arm rather than fail while a duplicate-filename prompt is
          // open: a user thinking about Replace vs Save-as-new for 30s
          // would otherwise get "Could not save your form" with the modal
          // still on screen.
          let timeoutId = 0;
          const arm = () => {
            timeoutId = window.setTimeout(() => {
              if (isDuplicatePromptOpen()) {
                arm();

                return;
              }
              resolve({ ok: false, reason: "error" });
            }, 30_000);
          };

          arm();

          window.dispatchEvent(
            new CustomEvent("editor:w9-save-and-continue", {
              detail: {
                onComplete: (result: {
                  ok: boolean;
                  reason?:
                    | "error"
                    | "not-signed-in"
                    | "cancelled"
                    | "cancelled-duplicate"
                    | "not-ready";
                }) => {
                  window.clearTimeout(timeoutId);
                  resolve(result);
                },
              },
            }),
          );
        });

        toast.close(w9LoadingKey);

        if (w9Result.ok) {
          if (
            w9Result.reason !== "not-ready" &&
            w9Result.reason !== "not-signed-in"
          ) {
            toast.success({
              title: "Saved to My PDFs",
              description: "Your form in My PDFs is up to date.",
            });
          }
          navigate();

          return;
        }

        if (w9Result.reason === "cancelled-duplicate") {
          // The user declined the filename prompt. Nothing is wrong and
          // nothing is lost, but they pressed Back and we are deliberately
          // NOT leaving — say so, or the click looks broken.
          toast.info({
            title: "Not saved — still on your form",
            description:
              "Nothing was lost. Choose Replace or a new name to save it, or use your browser's Back button to leave without saving.",
          });

          return;
        }

        if (w9Result.reason === "cancelled") {
          // User closed the paywall — stay on the form so they can
          // decide (retry or Download later). Nothing to toast; the
          // paywall UI already surfaces its own state.
          return;
        }

        toast.error({
          title: "Could not save your form",
          description:
            "We couldn't save it before leaving. Please try Save again.",
        });

        return;
      }

      isNavigatingRef.current = true;

      // Row 25: snapshot the dirty flag BEFORE the forced save. The
      // nav-save flow is defensive — it runs `force: true` even when the
      // store is clean to catch edit paths that didn't flip
      // `hasUnsavedChanges`. If the forced re-save fails but the store
      // was already clean, nothing was actually lost — suppress the
      // "Could not save" toast so users who just completed a
      // (Image/Whiteout/Redaction) + Save cycle aren't warned about a
      // non-event.
      const hadDirtyChangesOnEntry =
        usePdfEditorStore.getState().hasUnsavedChanges;

      const loadingKey = toast.loading({
        title: "Saving…",
        description: "Saving your edits before you leave.",
      });

      // Belt-and-braces flush of the live canvas BEFORE the save
      // chain starts — mirrors the identical block in
      // `useSaveEditor.onSaveBeforeAction`. Without this, a logo /
      // Back / My PDFs click while the user is mid-typing an IText
      // (Fabric hasn't fired `editing:exited` because focus went to
      // the header button, not the canvas), mid-drag, or immediately
      // after a shape/drawing that hasn't yet propagated to
      // `fabricJsonByPage` ships stale content to the backend — the
      // exact user report 2026-09-09: "when I click on logo while
      // editing, the editing must be saved properly just like all
      // the layers and editing in other operations." Two-step
      // commit:
      //
      //   1. Force-exit any IText/Textbox still in editing mode.
      //      `editing:exited` fires synchronously, which
      //      `use-edit-text-mode` turns into a `saveFabricJson`.
      //   2. `flushLiveFabricPage` synchronously serializes the
      //      current live canvas into
      //      `fabricJsonByPage[currentPage]` so anything mid-drag /
      //      already committed by the tool hooks is guaranteed to
      //      be in the store before `persistEditorDocument` reads
      //      it. Safe with a null `fabricRef.current` — the helper
      //      guards for it.
      if (fabricRef.current) {
        try {
          const fc = fabricRef.current;
          const active = fc.getActiveObject() as {
            isEditing?: boolean;
            exitEditing?: () => void;
          } | null;

          if (active?.isEditing && typeof active.exitEditing === "function") {
            active.exitEditing();
            fc.renderAll();
          }
          flushLiveFabricPage(usePdfEditorStore.getState().currentPage, fc);
        } catch (flushErr) {
          logger.warn(
            "[PDFedits] navigate-after-save: pre-save flush threw (ignored)",
            flushErr,
          );
        }
      }

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
          // Same duplicate gate as the button-Save so a Back click on
          // a fresh file with a same-name library twin prompts the
          // user (Overwrite / Cancel) rather than silently duplicating
          // or failing on backend uniqueness.
          checkFilenameDuplicate: true,
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
            // Rows 25 + 87 QA 2026-10-04: force-navigate paths
            // (logo-click, Back) run this handler regardless of
            // `hasUnsavedChanges`, so a user who already saved and
            // then clicks Back/Logo can still hit a backend conflict
            // on the second (force) save and see the scary "try Save
            // first" toast even though NOTHING is at risk. Only warn
            // when there were unsaved changes at entry — a clean-store
            // forced re-save that happens to fail has nothing for the
            // user to recover.
            if (hadDirtyChangesOnEntry) {
              toast.error({
                title: "Could not save",
                description:
                  "We couldn't save your PDF before leaving. Please try Save first.",
              });
            } else {
              navigate();
            }
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
            // QA 2026-09-06 copy: "Sign in" → "Login".
            toast.info({
              title: "Login to save",
              description: "Login to keep your edits in your library.",
            });
            navigate();
          } else if (result.reason === "cancelled-duplicate") {
            // User cancelled the "file already exists" prompt. Respect
            // that decision: don't overwrite, don't error — just let
            // the navigation proceed with local state intact. The
            // pending-editor-file mirror + hydrator will re-hydrate
            // on the destination if the user comes back.
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
        // Rows 25 + 87 QA 2026-10-04: same gate as the
        // result.reason === "error" branch — only alarm the user when
        // their work was actually at risk.
        if (hadDirtyChangesOnEntry) {
          toast.error({
            title: "Could not save",
            description:
              "We couldn't save your PDF before leaving. Please try Save first.",
          });
        } else {
          navigate();
        }
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
