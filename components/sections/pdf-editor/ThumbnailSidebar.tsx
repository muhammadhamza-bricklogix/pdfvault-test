"use client";

import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef, useState } from "react";

import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { usePdfEditorStore } from "@/lib/client/stores";

const THUMBNAIL_ZOOM = 0.2;

type ThumbnailProps = {
  isActive: boolean;
  pageNumber: number;
  onSelect: (page: number) => void;
};

function Thumbnail({ isActive, pageNumber, onSelect }: ThumbnailProps) {
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Lazy load via IntersectionObserver
  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // Load the PDFPageProxy once visible
  useEffect(() => {
    if (!isVisible || !pdfDocument) return;

    let cancelled = false;

    pdfDocument.getPage(pageNumber).then((p) => {
      if (!cancelled) setPage(p);
    });

    return () => {
      cancelled = true;
    };
  }, [isVisible, pageNumber, pdfDocument]);

  usePageRenderer({ canvasRef, page, zoom: THUMBNAIL_ZOOM });

  return (
    <button
      ref={containerRef}
      aria-label={`Go to page ${pageNumber}`}
      aria-selected={isActive}
      className={`flex w-full flex-col items-center gap-1 rounded-lg p-2 text-left transition-colors ${
        isActive
          ? "bg-[var(--app-accent-subtle)] ring-1 ring-[var(--color-accent)]"
          : "hover:bg-[var(--app-surface)]"
      }`}
      role="option"
      onClick={() => onSelect(pageNumber)}
    >
      <div className="flex min-h-28 w-full items-center justify-center overflow-hidden rounded border border-[var(--app-border)] bg-white shadow-sm">
        <canvas ref={canvasRef} />
      </div>
      <span className="text-xs text-[var(--app-muted)]">{pageNumber}</span>
    </button>
  );
}

export function ThumbnailSidebar() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);

  return (
    <aside
      aria-label="Page thumbnails"
      className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-surface)] p-2"
      role="listbox"
    >
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => (
        <Thumbnail
          key={pageNumber}
          isActive={pageNumber === currentPage}
          pageNumber={pageNumber}
          onSelect={setCurrentPage}
        />
      ))}
    </aside>
  );
}
