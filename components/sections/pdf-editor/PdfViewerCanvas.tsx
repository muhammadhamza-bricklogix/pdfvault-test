"use client";

import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef, useState } from "react";

import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { usePdfEditorStore } from "@/lib/client/stores";

export function PdfViewerCanvas() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const zoom = usePdfEditorStore((s) => s.zoom);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);

  useEffect(() => {
    if (!pdfDocument) return;

    let cancelled = false;

    pdfDocument.getPage(currentPage).then((p) => {
      if (!cancelled) setPage(p);
    });

    return () => {
      cancelled = true;
    };
  }, [currentPage, pdfDocument]);

  usePageRenderer({ canvasRef, page, zoom });

  return (
    <div className="flex flex-1 items-start justify-center overflow-auto bg-[var(--app-surface)] p-6">
      <div className="shadow-lg">
        <canvas
          ref={canvasRef}
          aria-label={`PDF page ${currentPage}`}
          role="img"
        />
      </div>
    </div>
  );
}
