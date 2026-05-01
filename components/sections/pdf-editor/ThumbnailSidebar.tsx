"use client";

import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef, useState } from "react";

import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { usePdfEditorStore } from "@/lib/client/stores";

const THUMBNAIL_ZOOM = 0.2;

type ThumbnailOrientation = "horizontal" | "vertical";

type ThumbnailProps = {
  isActive: boolean;
  orientation?: ThumbnailOrientation;
  pageNumber: number;
  onSelect: (page: number) => void;
};

function Thumbnail({
  isActive,
  orientation = "vertical",
  pageNumber,
  onSelect,
}: ThumbnailProps) {
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

  const isHorizontal = orientation === "horizontal";
  const rootClass = isHorizontal
    ? "flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg p-1.5 text-left transition-colors"
    : "flex w-full flex-col items-center gap-1 rounded-lg p-2 text-left transition-colors";
  const frameClass = isHorizontal
    ? "flex h-20 w-full items-center justify-center overflow-hidden rounded border border-default-200 bg-white shadow-sm"
    : "flex min-h-28 w-full items-center justify-center overflow-hidden rounded border border-default-200 bg-white shadow-sm";

  return (
    <button
      ref={containerRef}
      aria-label={`Go to page ${pageNumber}`}
      aria-selected={isActive}
      className={`${rootClass} ${
        isActive
          ? "bg-accent/10 ring-1 ring-[var(--color-accent)]"
          : "hover:bg-default-100"
      }`}
      role="option"
      onClick={() => onSelect(pageNumber)}
    >
      <div className={frameClass}>
        <canvas ref={canvasRef} />
      </div>
      <span className="text-xs text-default-500">{pageNumber}</span>
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
      className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-default-200 bg-default-100 p-2"
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

export function ThumbnailStrip() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);

  return (
    <div
      aria-label="Page thumbnails"
      className="flex w-full gap-1 overflow-x-auto overflow-y-hidden px-2 py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1"
      role="listbox"
    >
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => (
        <Thumbnail
          key={pageNumber}
          isActive={pageNumber === currentPage}
          orientation="horizontal"
          pageNumber={pageNumber}
          onSelect={setCurrentPage}
        />
      ))}
    </div>
  );
}
