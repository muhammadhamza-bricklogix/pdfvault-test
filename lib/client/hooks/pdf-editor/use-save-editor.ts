"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

type SaveBeforeActionDetail = {
  onComplete: (result: { ok: boolean }) => void;
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
      // Force the upload on explicit user click — bypasses the
      // `hasUnsavedChanges` short-circuit so the current editor state
      // is GUARANTEED to land as a fresh version on the backend, even
      // if some edit path (page numbers / annotations / Manage Pages /
      // restore-from-version) didn't flip the dirty flag. Auto-saves
      // and navigation saves keep the short-circuit (force omitted).
      // QA report 2026-06-16: "even the most recent changes are not
      // saved in the version."
      const result = await persistEditorDocument({
        fabricCanvas: fabricRef.current,
        force: true,
      });

      if (!result.ok) {
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

      toast.success({
        title: "Saved",
        description: "Your PDF was saved to your library.",
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

      const result = await persistEditorDocument({
        fabricCanvas: fabricRef.current,
      });

      if (result.ok) {
        // Commit the saved bytes as the new editor baseline. Without this,
        // downstream readers (Manage Pages thumbnails, exports) still see the
        // pre-edit source PDF until the next full reload — the visible bug
        // the user reported on Manage Pages.
        const targetFile = result.savedFile;

        usePdfEditorStore
          .getState()
          .applyPostSaveReset(targetFile, result.remappedState);

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

        onComplete({ ok: true });

        return;
      }

      // `no-changes` is a benign short-circuit (dirty flag was already clean
      // by the time the save ran). Treat as success — nothing to commit and
      // nothing to lose by proceeding.
      onComplete({ ok: result.reason === "no-changes" });
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
