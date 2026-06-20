"use client";

import type { Canvas as FabricCanvas } from "fabric";
import type { FormFieldValue } from "@/lib/client/pdf-editor/form-fields";

import { useCallback, useEffect, useRef } from "react";

import { applyFormFieldValues } from "@/lib/client/pdf-editor/form-fields";
import { usePdfEditorStore } from "@/lib/client/stores";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type FormFieldsApplyDetail = {
  flatten: boolean;
  values: FormFieldValue[];
};

/**
 * Listens for `editor:apply-form-fields` (dispatched by FormFieldsModal),
 * writes the user's form values back through pdf-lib against the SOURCE
 * file bytes (not the buildEditedPdfBytes pipeline — that creates a fresh
 * output PDF which would strip the AcroForm before we could write to it),
 * optionally flattens, and downloads.
 */
export function useFormFieldsEditor(_fabricCanvas: FabricCanvas | null) {
  const file = usePdfEditorStore((s) => s.file);

  const isRunningRef = useRef(false);
  const stateRef = useRef({ file });

  useEffect(() => {
    stateRef.current = { file };
  }, [file]);

  const handleApply = useCallback(async (detail: FormFieldsApplyDetail) => {
    if (isRunningRef.current) return;

    const { file: sourceFile } = stateRef.current;

    if (!sourceFile) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before filling form fields.",
      });

      return;
    }

    isRunningRef.current = true;
    const loadingKey = toast.loading({
      title: detail.flatten ? "Flattening form" : "Saving form values",
      description: detail.flatten
        ? "Baking your form values into the PDF."
        : "Writing values back onto the form.",
    });

    try {
      const bytes = await sourceFile.arrayBuffer();

      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
      });

      applyFormFieldValues(pdfDoc, detail.values, detail.flatten);

      const updated = await pdfDoc.save();
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "document";
      const suffix = detail.flatten ? "(flattened)" : "(filled)";
      const blob = new Blob([updated.buffer as ArrayBuffer], {
        type: "application/pdf",
      });

      triggerBlobDownload(blob, `${baseName} ${suffix}.pdf`);

      toast.close(loadingKey);
      toast.success({
        title: detail.flatten ? "Form flattened" : "Form filled",
        description: "Your PDF has been downloaded.",
      });
    } catch (err) {
      logger.error("Failed to apply form values", err);
      toast.close(loadingKey);
      toast.error({
        title: "Couldn't update form",
        description: "We couldn't write the form values. Please try again.",
      });
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onApply = (event: Event) => {
      const detail = (event as CustomEvent<FormFieldsApplyDetail>).detail;

      if (!detail) return;

      void handleApply(detail);
    };

    window.addEventListener("editor:apply-form-fields", onApply);

    return () => {
      window.removeEventListener("editor:apply-form-fields", onApply);
    };
  }, [handleApply]);
}
