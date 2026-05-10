"use client";

import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect } from "react";

import { extractTextItems } from "@/lib/client/pdf-editor/extract-text";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseTextExtractionCacheParams = {
  currentPage: number;
  page: PDFPageProxy | null;
};

// Extract at zoom=1 so coords live in the same base space Fabric uses
// (see use-fabric-canvas.ts — objects are stored at zoom=1 and Fabric
// applies setZoom() for display). This also means coords map 1:1 to PDF
// points, which the export pipeline can consume directly.
export function useTextExtractionCache({
  currentPage,
  page,
}: UseTextExtractionCacheParams) {
  const setExtractedTextForPage = usePdfEditorStore(
    (s) => s.setExtractedTextForPage,
  );

  useEffect(() => {
    if (!page) return;

    let cancelled = false;

    extractTextItems(page, 1).then((items) => {
      if (cancelled) return;
      setExtractedTextForPage(currentPage, items);
    });

    return () => {
      cancelled = true;
    };
  }, [page, currentPage, setExtractedTextForPage]);
}
