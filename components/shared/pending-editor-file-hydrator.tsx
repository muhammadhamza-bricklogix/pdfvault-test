"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Bootstraps the editor on `/pdf-composer` mount:
 *
 * 1. **Rehydrate** — if IndexedDB has a File left over from an old flow
 *    (belt-and-braces; the new `UploadWorkspace` no longer writes to IDB),
 *    load it into the store.
 * 2. **Auto-save to library (signed-in only)** — the first time a File is
 *    seen in the store without a matching Document ID, POST it to
 *    `/documents/upload` so it appears in Dashboard → My PDFs and future
 *    Save actions overwrite the same row.
 * 3. **Auto-launch tool** — if the URL carries `?tool=<slug>` and/or
 *    `?export=<format>`, fire the matching editor action once the store
 *    has a File. The mapping mirrors the toolbar / HamburgerMenu event
 *    bus so we don't duplicate the modal-open logic.
 *
 * Slugs:
 *   compress          → CompressModal
 *   password / unlock → PasswordModal (mode inferred by the modal)
 *   manage            → ManagePagesModal
 *   split             → dispatch `editor:open-split` (HamburgerMenu bridge)
 *   watermark         → setActiveTool("watermark")
 *   extract-images    → dispatch `editor:extract-images`
 *   flatten           → dispatch `editor:open-flatten` (HamburgerMenu bridge)
 *
 * Export formats: docx / xlsx / pptx / jpg / png / html / txt — fired via
 * `editor:export` with the matching `ExportFormat` detail.
 */
export function PendingEditorFileHydrator() {
  const ranRef = useRef(false);
  const launchedRef = useRef(false);
  const autoSavedRef = useRef(false);

  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const setIsPasswordModalOpen = usePdfEditorStore(
    (s) => s.setIsPasswordModalOpen,
  );
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const currentFile = usePdfEditorStore((s) => s.file);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const tool = searchParams.get("tool");
  const exportFormat = searchParams.get("export");

  // Step 1 — one-shot IDB rehydrate.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const file = await loadPendingEditorFile();

        if (cancelled || !file) return;
        if (currentFile) {
          await clearPendingEditorFile();

          return;
        }
        setCurrentDocument(null);
        setFile(file);
        await clearPendingEditorFile();
      } catch (err) {
        logger.warn("pending editor file hydrate failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentFile, setCurrentDocument, setFile]);

  // Step 2 — background auto-save for signed-in users. Fires once per
  // file-without-doc-id combo. Failure is non-blocking; the editor still
  // opens and the user can hit Save manually.
  useEffect(() => {
    if (autoSavedRef.current) return;
    if (!currentFile) return;
    if (currentDocumentId) return; // already tied to a document row

    autoSavedRef.current = true;

    void (async () => {
      try {
        const document = await documentsService.uploadDocument({
          file: currentFile,
        });

        setCurrentDocument({ id: document.id, name: document.filename });
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        toast.success({
          title: "Saved to My PDFs",
          description: document.filename,
        });
      } catch (err) {
        // Expected for signed-out visitors (401). Silent for that case,
        // logged for anything else.
        const status = (err as { response?: { status?: number } })?.response
          ?.status;

        if (status !== 401) logger.warn("editor auto-save failed", err);
        autoSavedRef.current = false; // allow retry on next file load
      }
    })();
  }, [currentDocumentId, currentFile, queryClient, setCurrentDocument]);

  // Step 3 — tool / export auto-launch, one-shot per URL. Waits for the
  // file to be non-null so the modals don't open on an empty editor.
  useEffect(() => {
    if (launchedRef.current) return;
    if (!currentFile) return;
    if (!tool && !exportFormat) return;

    launchedRef.current = true;

    // Small delay so the editor's own file-load pipeline (Fabric mount +
    // pdf.js hydrate) settles before we open a modal on top of it. The
    // modals are cheap; the risk is that a modal opens over a still-blank
    // canvas and looks jarring.
    const timeoutId = window.setTimeout(() => {
      if (tool) {
        switch (tool) {
          case "compress":
            setIsCompressModalOpen(true);
            break;
          case "password":
          case "unlock":
            setIsPasswordModalOpen(true);
            break;
          case "manage":
            setIsManagePagesOpen(true);
            break;
          case "split":
            window.dispatchEvent(new CustomEvent("editor:open-split"));
            break;
          case "watermark":
            setActiveTool("watermark");
            break;
          case "extract-images":
            window.dispatchEvent(new CustomEvent("editor:extract-images"));
            break;
          case "flatten":
            window.dispatchEvent(new CustomEvent("editor:open-flatten"));
            break;
          default:
            logger.warn(`unknown auto-launch tool: ${tool}`);
        }
      }
      if (exportFormat) {
        window.dispatchEvent(
          new CustomEvent("editor:export", {
            detail: { format: exportFormat },
          }),
        );
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentFile,
    exportFormat,
    setActiveTool,
    setIsCompressModalOpen,
    setIsManagePagesOpen,
    setIsPasswordModalOpen,
    tool,
  ]);

  return null;
}
