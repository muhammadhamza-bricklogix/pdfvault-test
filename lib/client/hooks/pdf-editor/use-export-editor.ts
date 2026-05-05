"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

function buildExportFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;

  return `${base} (edited).pdf`;
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Listens for `editor:export` (dispatched by the Export menu) and runs the
 * flatten-and-download pipeline locally. No upload, no auth.
 */
export function useExportEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);

  const isExportingRef = useRef(false);
  const stateRef = useRef({ currentPage, fabricCanvas, file });

  useEffect(() => {
    stateRef.current = { currentPage, fabricCanvas, file };
  }, [currentPage, fabricCanvas, file]);

  const handleExport = useCallback(async () => {
    if (isExportingRef.current) return;

    const {
      currentPage: page,
      fabricCanvas: liveCanvas,
      file: sourceFile,
    } = stateRef.current;

    if (!sourceFile) {
      toast.error({
        title: "Nothing to export",
        description: "Open a PDF before exporting.",
      });

      return;
    }

    isExportingRef.current = true;

    try {
      const bytes = await buildEditedPdfBytes({
        currentPage: page,
        fabricCanvas: liveCanvas,
        file: sourceFile,
      });

      downloadBytes(bytes, buildExportFilename(sourceFile.name));

      toast.success({
        title: "Exported",
        description: "Your edited PDF has been downloaded.",
      });
    } catch (err) {
      logger.error("Failed to export PDF", err);
      toast.error({
        title: "Export failed",
        description: "We couldn't export your edits. Please try again.",
      });
    } finally {
      isExportingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onExport = () => {
      void handleExport();
    };

    window.addEventListener("editor:export", onExport);

    return () => {
      window.removeEventListener("editor:export", onExport);
    };
  }, [handleExport]);
}
