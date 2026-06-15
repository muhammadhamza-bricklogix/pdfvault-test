"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { useExtractImagesMutation } from "@/lib/client/query/mutations/pdf-tools.mutation";
import { usePdfEditorStore } from "@/lib/client/stores";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Listens for `editor:extract-images` (dispatched by HamburgerMenu) and
 * POSTs the user's `store.file` directly to the extract-images backend.
 *
 * Why so plain — history of three failed approaches:
 *
 *   1. **Original** (before 2026-06-10 f): posted `store.file` directly.
 *      Bug: any image the user added in-session via the image tool
 *      lived only as a Fabric overlay, so the backend never saw it and
 *      either returned 400 or an empty zip.
 *
 *   2. **Inline `buildEditedPdfBytes({ bakeOverlays: true })`** (the (f)
 *      fix): baked overlays into a fresh buffer, posted that. Bug:
 *      `mergeFabricEditsIntoPdf` calls `pdfDocument.getPage(n).render({
 *      operationsFilter })` on the SAME pdf.js doc that `usePageRenderer`
 *      uses for the live editor canvas. Concurrent renders on a shared
 *      `PDFPageProxy` race in pdf.js v5 → live canvas drops text, only
 *      the rasterized layer left.
 *
 *   3. **`saveBeforeAction` then post `store.file`** (2026-06-15 a): no
 *      shared-doc race, but the save flow itself takes Case 3 in
 *      `mergeFabricEditsIntoPdf` for every page that has any Fabric
 *      overlay (including the IText layer that `useEditTextMode`
 *      created from the source text). Case 3 rasterizes the original
 *      page to PNG and draws Fabric objects on top — selectable text
 *      becomes pixels. After save, `store.file` is image-only.
 *      Exporting it gives a PDF with no selectable text. User saw this
 *      and pushed back hard.
 *
 * So we're back to **post `store.file` directly** — accepting the
 * (1) trade-off: an image the user added in-session is NOT in the
 * extracted zip unless they hit Save first themselves. That's an
 * explicit user choice — Save flattens text, so we don't auto-trigger
 * it from extract-images. If the trade-off bites later we should make
 * Save preserve text-object pages (Case 1 always for `editModeText`-only
 * overlays); that's a `merge-pdf.ts` change that needs careful review
 * because the file is flagged off-limits.
 */
export function useExtractImagesEditor(_fabricCanvas: FabricCanvas | null) {
  // fabricCanvas isn't read directly — the live canvas isn't touched.
  // Argument retained for call-site signature stability.
  const extractImages = useExtractImagesMutation();

  const isRunningRef = useRef(false);
  const extractRef = useRef(extractImages);

  useEffect(() => {
    extractRef.current = extractImages;
  }, [extractImages]);

  const handleExtract = useCallback(async () => {
    if (isRunningRef.current) return;

    const sourceFile = usePdfEditorStore.getState().file;

    if (!sourceFile) {
      toast.error({
        title: "Nothing to extract from",
        description: "Open a PDF before extracting images.",
      });

      return;
    }

    isRunningRef.current = true;

    try {
      const result = await extractRef.current.mutateAsync({
        file: sourceFile,
      });

      triggerBlobDownload(result.blob, result.fileName);
    } catch (err) {
      logger.error("Failed to extract images", err);
      // Mutation's onError already surfaces a toast for HTTP failures.
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
