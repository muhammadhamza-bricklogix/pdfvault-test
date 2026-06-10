"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { useExtractImagesMutation } from "@/lib/client/query/mutations/pdf-tools.mutation";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Listens for `editor:extract-images` (dispatched by HamburgerMenu) and
 * runs the extract-images backend call against the user's CURRENT edited
 * PDF — not the original upload.
 *
 * The original bug: `HamburgerMenu.runExtractImages` sent the store's raw
 * `file` straight to the backend. Any images the user added through the
 * editor's image tool live only as Fabric overlay objects until a Save
 * bakes them into the PDF. The backend therefore saw the unedited bytes
 * and either returned 400 (`no images`) or an empty zip — manifesting on
 * the client as "I added images but it says none found."
 *
 * This hook lives inside the editor shell where the live `fabricCanvas` is
 * available, mirrors `useExportEditor`, and uses `buildEditedPdfBytes`
 * with `bakeOverlays: true` so every user-added image becomes a real
 * embedded image in the bytes we POST.
 */
export function useExtractImagesEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const extractImages = useExtractImagesMutation();

  const isRunningRef = useRef(false);
  const stateRef = useRef({ currentPage, fabricCanvas, file });

  useEffect(() => {
    stateRef.current = { currentPage, fabricCanvas, file };
  }, [currentPage, fabricCanvas, file]);

  const extractRef = useRef(extractImages);

  useEffect(() => {
    extractRef.current = extractImages;
  }, [extractImages]);

  const handleExtract = useCallback(async () => {
    if (isRunningRef.current) return;

    const {
      currentPage: page,
      fabricCanvas: liveCanvas,
      file: sourceFile,
    } = stateRef.current;

    if (!sourceFile) {
      toast.error({
        title: "Nothing to extract from",
        description: "Open a PDF before extracting images.",
      });

      return;
    }

    isRunningRef.current = true;

    try {
      // Bake overlays so user-added images (image tool, signature, watermark
      // image) become real embedded images that the backend will recognise.
      const bytes = await buildEditedPdfBytes({
        bakeOverlays: true,
        currentPage: page,
        fabricCanvas: liveCanvas,
        file: sourceFile,
      });
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "document";
      const pdfFile = new File(
        [bytes.buffer as ArrayBuffer],
        `${baseName}.pdf`,
        { type: "application/pdf" },
      );
      const result = await extractRef.current.mutateAsync({ file: pdfFile });

      triggerBlobDownload(result.blob, result.fileName);
    } catch (err) {
      logger.error("Failed to extract images", err);
      // Mutation's onError already surfaces a toast for HTTP failures; only
      // log here for the build-bytes path so the user isn't left silent if
      // the merge step throws.
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
