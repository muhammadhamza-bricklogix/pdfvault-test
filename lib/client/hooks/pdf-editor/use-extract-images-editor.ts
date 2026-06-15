"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { useExtractImagesMutation } from "@/lib/client/query/mutations/pdf-tools.mutation";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Listens for `editor:extract-images` (dispatched by HamburgerMenu) and
 * runs the extract-images backend call against the user's CURRENT edited
 * PDF — not the original upload.
 *
 * Strategy: **save-before-extract**. We let the regular Save flow bake
 * every Fabric overlay (image-tool inserts, shapes, IText) into the
 * cloud-saved PDF, which also swaps `store.file` to the merged bytes.
 * Then we POST that file straight to the extract endpoint.
 *
 * Why not call `buildEditedPdfBytes` inline (the previous approach):
 *   • That path shares the live editor's pdfDocument proxy with
 *     `usePageRenderer` and can race against the live render,
 *     leaving the user's canvas with text dropped — only the
 *     rasterized image layer visible. Save-before-extract avoids it
 *     because the bake happens inside `persistEditorDocument`, which
 *     already coordinates with the live canvas (flushes overlays,
 *     then `applyPostSaveReset` swaps `file` to the merged bytes).
 *   • The user added images via the image tool? Save bakes them.
 *     The extract backend sees a real embedded image. No 400.
 *   • Saves are cheap when nothing's dirty: `saveBeforeAction`
 *     short-circuits and resolves immediately.
 */
export function useExtractImagesEditor(_fabricCanvas: FabricCanvas | null) {
  // fabricCanvas no longer needed in this hook — the save-before-action
  // path coordinates with the live canvas internally via `useSaveEditor`.
  // Argument retained for the call-site signature stability in
  // `PdfEditorShell.tsx`.
  const extractImages = useExtractImagesMutation();

  const isRunningRef = useRef(false);
  const extractRef = useRef(extractImages);

  useEffect(() => {
    extractRef.current = extractImages;
  }, [extractImages]);

  const handleExtract = useCallback(async () => {
    if (isRunningRef.current) return;

    if (!usePdfEditorStore.getState().file) {
      toast.error({
        title: "Nothing to extract from",
        description: "Open a PDF before extracting images.",
      });

      return;
    }

    isRunningRef.current = true;

    try {
      // Save first so any pending overlays (image tool, shapes, IText)
      // are baked into the cloud PDF. After this returns true,
      // `store.file` has been swapped to the merged bytes via
      // `applyPostSaveReset`. Short-circuits when nothing is dirty.
      const ok = await saveBeforeAction(
        "Saving your edits before extracting images.",
      );

      if (!ok) return;

      // Read the now-up-to-date file directly from the store, post-save.
      const sourceFile = usePdfEditorStore.getState().file;

      if (!sourceFile) return;

      const result = await extractRef.current.mutateAsync({
        file: sourceFile,
      });

      triggerBlobDownload(result.blob, result.fileName);
    } catch (err) {
      logger.error("Failed to extract images", err);
      // Mutation's onError already surfaces a toast for HTTP failures;
      // only log here so the failure isn't completely silent.
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onExtract = () => {
      void handleExtract();
    };

    window.addEventListener("editor:extract-images", onExtract);

    return () => {
      window.removeEventListener("editor:extract-images", onExtract);
    };
  }, [handleExtract]);
}
