"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

type SaveBeforeActionDetail = {
  force?: boolean;
  // When true, upload the current edits to the user's library but do NOT
  // call `applyPostSaveReset` — leave `store.file` on the ORIGINAL bytes.
  // Used by the Download flow (`ExportFormatModal`) so the subsequent
  // `editor:export` runs a single clean merge against the original file +
  // live overlays, instead of racing pdf.js reload + Fabric remount against
  // an already-baked `savedFile`. See ExportFormatModal comment + QA
  // report 2026-08-19 ("edited changes gone, some appear at the very
  // bottom" on any download format).
  skipReset?: boolean;
  // When true, apply the post-save reset (swap `store.file` to the newly
  // saved bytes) but DO NOT await the pdf.js reload before resolving.
  // Callers that only need the fresh `File` blob (e.g. Share — creates a
  // link by uploading the raw bytes and never touches `pdfDocument`) can
  // opt out of the wait to avoid stalling the follow-up UI when pdf.js
  // reload is slow or hangs. The `applyPostSaveReset` still fires so
  // `store.file` reflects the latest edits before the caller resumes.
  skipWait?: boolean;
  onComplete: (result: {
    ok: boolean;
    reason?:
      | "error"
      | "no-changes"
      | "no-file"
      | "not-signed-in"
      | "not-loaded";
  }) => void;
};

/**
 * Listens for `editor:save` (dispatched by the Save button) and uploads the
 * flattened PDF to the user's library.
 *
 * Also listens for `editor:save-before-action`, used by flows that need to
 * persist the live canvas state before doing something destructive to the
 * editor (e.g. Hamburger → Create New). The event detail carries a callback
 * that fires once the save completes (or fails) so the dispatcher can decide
 * whether to proceed. This routes through here because `fabricCanvas` lives in
 * `EditorLayout` — modals mounted at shell-level otherwise see `null` and
 * silently upload stale `fabricJsonByPage` from the store.
 */
export function useSaveEditor(fabricCanvas: FabricCanvas | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isSavingRef = useRef(false);
  const fabricRef = useRef(fabricCanvas);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;

    isSavingRef.current = true;

    const loadingKey = toast.loading({
      title: "Saving…",
      description: "Saving your PDF to your library.",
    });

    try {
      logger.event(EVENTS.SAVE_START, "info", { source: "button" });
      // Force the upload on explicit user click — bypasses the
      // `hasUnsavedChanges` short-circuit so the current editor state
      // is GUARANTEED to land as a fresh version on the backend, even
      // if some edit path (page numbers / annotations / Manage Pages /
      // restore-from-version) didn't flip the dirty flag. Auto-saves
      // and navigation saves keep the short-circuit (force omitted).
      // QA report 2026-06-16: "even the most recent changes are not
      // saved in the version."
      const result = await logger.span(
        "save.persist",
        "editor.save",
        () =>
          persistEditorDocument({
            fabricCanvas: fabricRef.current,
            force: true,
          }),
        { source: "button" },
      );

      if (!result.ok) {
        logger.event(EVENTS.SAVE_BLOCKED, "warning", { reason: result.reason });
        if (result.reason === "no-changes") {
          toast.info({
            title: "Already saved",
            description: "No changes since your last save.",
          });
        } else if (result.reason === "no-file") {
          toast.error({
            title: "Nothing to save",
            description: "Open a PDF before saving.",
          });
        } else if (result.reason === "not-signed-in") {
          toast.error({
            title: "Sign in required",
            description: "Sign in to save your edits to the cloud.",
          });
        } else if (result.reason === "not-loaded") {
          toast.error({
            title: "PDF still loading",
            description:
              "Wait for the document to finish loading, then try again.",
          });
        } else {
          toast.error({
            title: "Save failed",
            description: "We couldn't save your edits. Please try again.",
          });
        }

        return;
      }

      const id = result.document.id;

      // Commit the just-uploaded merged bytes as the new editor
      // baseline. Without this the local `store.file` stays as the
      // original upload, `fabricJsonByPage` keeps accumulating, and
      // every subsequent Save uploads bytes built from stale source +
      // duplicated overlays → cloud versions look functionally
      // identical to each other (the bug reported 2026-06-16). The
      // save-before-action path (Share / Manage Pages / Create New)
      // was already doing this; the regular Save button was missing.
      //
      // `remappedState` is present iff the user had drag-dropped pages in
      // the sidebar — it swaps the source-page-keyed editor state for the
      // new display-slot-keyed state that matches the just-saved bytes.
      usePdfEditorStore
        .getState()
        .applyPostSaveReset(result.savedFile, result.remappedState);

      if (searchParams.get("id") !== id) {
        const params = new URLSearchParams(searchParams.toString());

        params.set("id", id);
        router.replace(`${ROUTES.TOOLS.PDF_EDITOR}?${params.toString()}`);
      }

      logger.event(EVENTS.SAVE_OK, "info", { documentId: id });
      toast.success({
        title: "Saved",
        description: "Your PDF was saved to your library.",
      });
    } catch (err) {
      logger.captureError(err, "save.button");
      toast.error({
        title: "Save failed",
        description: "We couldn't save your edits. Please try again.",
      });
    } finally {
      toast.close(loadingKey);
      isSavingRef.current = false;
    }
  }, [router, searchParams]);

  useEffect(() => {
    const onSave = () => {
      void handleSave();
    };

    window.addEventListener("editor:save", onSave);

    return () => {
      window.removeEventListener("editor:save", onSave);
    };
  }, [handleSave]);

  useEffect(() => {
    const onSaveBeforeAction = async (event: Event) => {
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;
      const onComplete = detail?.onComplete;

      if (!onComplete) return;

      logger.event(EVENTS.SAVE_BEFORE_ACTION_START, "info", {
        force: Boolean(detail?.force),
      });
      const result = await logger.span(
        "save.persist_before_action",
        "editor.save",
        () =>
          persistEditorDocument({
            fabricCanvas: fabricRef.current,
            force: detail?.force,
          }),
        { source: "before_action" },
      );

      if (result.ok) {
        if (detail?.skipReset) {
          // Download flow: cloud save succeeded, but the caller is about to
          // fire `editor:export` immediately. Skipping the reset keeps
          // `store.file` on the ORIGINAL bytes so the export merge runs
          // against a stable source + live-canvas overlays. If we swapped to
          // `savedFile` here, pdf.js would reload and Fabric would remount
          // mid-flight, racing the export's `buildEditedPdfBytes` against a
          // moving `store.file` — producing double-baked / dropped edits.
          logger.event(EVENTS.SAVE_BEFORE_ACTION_OK, "info", {
            documentId: result.document.id,
          });
          onComplete({ ok: true });

          return;
        }

        // Commit the saved bytes as the new editor baseline. Without this,
        // downstream readers (Manage Pages thumbnails, exports) still see the
        // pre-edit source PDF until the next full reload — the visible bug
        // the user reported on Manage Pages.
        const targetFile = result.savedFile;

        usePdfEditorStore
          .getState()
          .applyPostSaveReset(targetFile, result.remappedState);

        // Share opts out via `skipWait`: it only needs the fresh `File`
        // blob (already committed above) and never reads `pdfDocument`.
        // The wait would otherwise stall the share modal open when pdf.js
        // reload is slow — the "clicking Share only saves, modal never
        // appears" bug reported 2026-08-21.
        if (detail?.skipWait) {
          logger.event(EVENTS.SAVE_BEFORE_ACTION_OK, "info", {
            documentId: result.document.id,
          });
          onComplete({ ok: true });

          return;
        }

        // Wait for `usePdfLoader` to finish reloading pdf.js against the new
        // bytes before resolving. Otherwise the caller (e.g. Manage Pages)
        // opens while `pdfDocument` is still null and renders an empty state
        // for a frame.
        await new Promise<void>((resolve) => {
          const isReady = () => {
            const s = usePdfEditorStore.getState();

            return s.file === targetFile && s.pdfDocument != null;
          };

          if (isReady()) {
            resolve();

            return;
          }

          const unsub = usePdfEditorStore.subscribe(() => {
            if (isReady()) {
              unsub();
              resolve();
            }
          });
        });

        logger.event(EVENTS.SAVE_BEFORE_ACTION_OK, "info", {
          documentId: result.document.id,
        });
        onComplete({ ok: true });

        return;
      }

      logger.event(EVENTS.SAVE_BEFORE_ACTION_BLOCKED, "warning", {
        reason: result.reason,
      });
      // `no-changes` is a benign short-circuit (dirty flag was already clean
      // by the time the save ran). Treat as success — nothing to commit and
      // nothing to lose by proceeding. Every other failure reason is
      // forwarded so the caller can decide whether to toast, prompt sign-in,
      // etc. — specifically, `not-signed-in` must route through the
      // sign-in prompt modal per the auth chain (CLAUDE.md items 4, 5, 17)
      // instead of surfacing as a generic "Could not save" error.
      onComplete({
        ok: result.reason === "no-changes",
        reason: result.reason,
      });
    };

    window.addEventListener(
      "editor:save-before-action",
      onSaveBeforeAction as EventListener,
    );

    return () => {
      window.removeEventListener(
        "editor:save-before-action",
        onSaveBeforeAction as EventListener,
      );
    };
  }, []);
}
