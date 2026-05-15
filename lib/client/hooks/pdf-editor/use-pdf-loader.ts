"use client";

import { useEffect, useState } from "react";

import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";
import { usePdfEditorStore } from "@/lib/client/stores";

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

      try {
        // Dynamic import keeps pdfjs-dist out of the SSR bundle entirely
        const pdfjs = await import("pdfjs-dist");

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

        setPdfDocument(doc, doc.numPages);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
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
