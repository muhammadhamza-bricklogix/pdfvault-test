"use client";

import { useEffect, useState } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

export function usePdfLoader() {
  const file = usePdfEditorStore((s) => s.file);
  const setPdfDocument = usePdfEditorStore((s) => s.setPdfDocument);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;

    let loadingTask: any = null;

    // Clear any previously loaded document immediately so consumers don't
    // hold a reference to a doc we're about to destroy.
    setPdfDocument(null, 0);

    const load = async () => {
      setIsLoading(true);
      setError(null);

      logger.info("[PDFedits] load: start", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      try {
        // loadPdfJs installs Safari polyfills and loads the legacy build.
        // See lib/client/pdf-editor/load-pdfjs.ts and pdfjs-polyfills.ts.
        const pdfjs = await loadPdfJs();

        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

        const arrayBuffer = await file.arrayBuffer();

        if (cancelled) return;

        loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          fontExtraProperties: true,
        });
        const doc = await loadingTask.promise;

        if (cancelled) {
          doc.destroy();

          return;
        }

        logger.info("[PDFedits] load: ok", { pages: doc.numPages });
        setPdfDocument(doc, doc.numPages);
      } catch (err) {
        logger.error("[PDFedits] load: failed", err);

        if (!cancelled) {
          // pdf.js throws PasswordException with `.name === "PasswordException"`
          // when the PDF is encrypted. Show a friendly message instead of the
          // raw "No password given" / "Incorrect password" technical strings.
          const name = (err as { name?: string })?.name;

          if (name === "PasswordException") {
            setError(
              "This PDF is password-protected. Remove the password from the PDF and try again.",
            );
          } else if (name === "InvalidPDFException") {
            setError("This file is not a valid PDF or appears to be corrupt.");
          } else {
            setError(err instanceof Error ? err.message : "Failed to load PDF");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
      // Drop the destroyed proxy from the store so canvas hooks don't try
      // to call methods on it after unmount or file change.
      setPdfDocument(null, 0);
    };
  }, [file, setPdfDocument]);

  return { error, isLoading };
}
