"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { useConvertFileMutation } from "@/lib/client/query/mutations/conversion.mutation";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type ExportFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "jpg"
  | "png"
  | "html"
  | "txt";

export type EditorExportEventDetail = {
  format: ExportFormat;
};

const FORMAT_TO_CONVERSION_TYPE: Record<
  Exclude<ExportFormat, "pdf">,
  | "pdf_to_docx"
  | "pdf_to_xlsx"
  | "pdf_to_pptx"
  | "pdf_to_jpg"
  | "pdf_to_png"
  | "pdf_to_html"
  | "pdf_to_txt"
> = {
  docx: "pdf_to_docx",
  html: "pdf_to_html",
  jpg: "pdf_to_jpg",
  png: "pdf_to_png",
  pptx: "pdf_to_pptx",
  txt: "pdf_to_txt",
  xlsx: "pdf_to_xlsx",
};

function buildPdfExportFilename(name: string): string {
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
 * Listens for `editor:export` (dispatched by the Export menu) and either:
 * - Runs the flatten-and-download PDF pipeline locally (format === "pdf"), or
 * - Flattens to a PDF blob first, then routes it through the /conversion
 *   backend to produce the requested non-PDF format.
 */
export function useExportEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const convert = useConvertFileMutation();

  const isExportingRef = useRef(false);
  const stateRef = useRef({ currentPage, fabricCanvas, file });

  useEffect(() => {
    stateRef.current = { currentPage, fabricCanvas, file };
  }, [currentPage, fabricCanvas, file]);

  const convertRef = useRef(convert);

  useEffect(() => {
    convertRef.current = convert;
  }, [convert]);

  const handleExport = useCallback(async (format: ExportFormat) => {
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
      // Export bakes the watermark + bg image into the downloaded copy. The
      // cloud-saved PDF intentionally does NOT have them baked (that's why
      // Save passes `bakeOverlays: false` / default) — keeping the source
      // file clean prevents per-save stacking and text-position drift. The
      // user's downloaded copy is the only place we bake on demand.
      const bytes = await buildEditedPdfBytes({
        currentPage: page,
        fabricCanvas: liveCanvas,
        file: sourceFile,
        bakeOverlays: true,
      });

      if (format === "pdf") {
        downloadBytes(bytes, buildPdfExportFilename(sourceFile.name));
        toast.success({
          title: "Exported",
          description: "Your edited PDF has been downloaded.",
        });

        return;
      }

      const conversionType = FORMAT_TO_CONVERSION_TYPE[format];
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "document";
      const pdfFile = new File(
        [bytes.buffer as ArrayBuffer],
        `${baseName}.pdf`,
        {
          type: "application/pdf",
        },
      );

      // The mutation owns its own loading/success/error toasts; we await the
      // result here so we can trigger the browser download from the returned
      // blob (otherwise the file is converted but never offered to the user).
      const result = await convertRef.current.mutateAsync({
        file: pdfFile,
        type: conversionType,
      });

      triggerBlobDownload(result.blob, result.fileName);
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
    const onExport = (event: Event) => {
      const detail = (event as CustomEvent<EditorExportEventDetail>).detail;
      const format = detail?.format ?? "pdf";

      void handleExport(format);
    };

    window.addEventListener("editor:export", onExport);

    return () => {
      window.removeEventListener("editor:export", onExport);
    };
  }, [handleExport]);
}
