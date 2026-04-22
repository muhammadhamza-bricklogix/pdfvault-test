"use client";

import { useEffect, useState } from "react";

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

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamic import keeps pdfjs-dist out of the SSR bundle entirely
        const pdfjs = await import("pdfjs-dist");

        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await file.arrayBuffer();

        if (cancelled) return;

        loadingTask = pdfjs.getDocument({ data: arrayBuffer });
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
    };
  }, [file, setPdfDocument]);

  return { error, isLoading };
}
