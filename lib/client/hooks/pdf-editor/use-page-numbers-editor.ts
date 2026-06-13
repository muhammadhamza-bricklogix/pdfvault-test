"use client";

import type { Canvas as FabricCanvas } from "fabric";
import type { AddPageNumbersOptions } from "@/lib/client/pdf-editor/add-page-numbers";

import { useCallback, useEffect, useRef } from "react";

import { addPageNumbersToPdf } from "@/lib/client/pdf-editor/add-page-numbers";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type PageNumbersEventDetail = {
  options: AddPageNumbersOptions;
};

/**
 * Listens for `editor:add-page-numbers` (dispatched by PageNumbersModal),
 * bakes current edits via `buildEditedPdfBytes`, stamps numbers via pdf-lib,
 * and downloads the resulting PDF. Mirrors the export/extract hook pattern
 * so the user's live Fabric edits make it into the output.
 */
export function usePageNumbersEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);

  const isRunningRef = useRef(false);
  const stateRef = useRef({ currentPage, fabricCanvas, file });

  useEffect(() => {
    stateRef.current = { currentPage, fabricCanvas, file };
  }, [currentPage, fabricCanvas, file]);

  const handleAdd = useCallback(async (options: AddPageNumbersOptions) => {
    if (isRunningRef.current) return;

    const {
      currentPage: page,
      fabricCanvas: liveCanvas,
      file: sourceFile,
    } = stateRef.current;

    if (!sourceFile) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before adding page numbers.",
      });

      return;
    }

    isRunningRef.current = true;
    const loadingKey = toast.loading({
      title: "Adding page numbers",
      description: "Stamping numbers onto your PDF.",
    });

    try {
      const bytes = await buildEditedPdfBytes({
        bakeOverlays: true,
        currentPage: page,
        fabricCanvas: liveCanvas,
        file: sourceFile,
      });

      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
      });

      await addPageNumbersToPdf(pdfDoc, options);
      const stamped = await pdfDoc.save();

      const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "document";
      const blob = new Blob([stamped.buffer as ArrayBuffer], {
        type: "application/pdf",
      });

      triggerBlobDownload(blob, `${baseName} (numbered).pdf`);

      toast.close(loadingKey);
      toast.success({
        title: "Page numbers added",
        description: "Your numbered PDF has been downloaded.",
      });
    } catch (err) {
      logger.error("Failed to add page numbers", err);
      toast.close(loadingKey);
      toast.error({
        title: "Couldn't add page numbers",
        description: "We couldn't stamp the numbers. Please try again.",
      });
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onAdd = (event: Event) => {
      const detail = (event as CustomEvent<PageNumbersEventDetail>).detail;

      if (!detail?.options) return;

      void handleAdd(detail.options);
    };

    window.addEventListener("editor:add-page-numbers", onAdd);

    return () => {
      window.removeEventListener("editor:add-page-numbers", onAdd);
    };
  }, [handleAdd]);
}
