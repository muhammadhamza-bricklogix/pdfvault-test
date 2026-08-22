"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef, useState } from "react";

export type RenderedPageInfo = {
  pdfWidth: number;
  pdfHeight: number;
  displayWidth: number;
  displayHeight: number;
};

type PageProps = {
  page: PDFPageProxy;
  pageNumber: number;
  scale: number;
  onReady: (pageNumber: number, info: RenderedPageInfo) => void;
  children?: React.ReactNode;
};

/**
 * One page → one canvas + the field overlay positioned over it. Each
 * `<PdfPage>` is a relative container so children (overlays) can absolutely
 * position themselves without worrying about other pages on the page.
 */
function PdfPage({ page, pageNumber, scale, onReady, children }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const viewport = page.getViewport({ scale: scale * dpr });
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const cssWidth = viewport.width / dpr;
    const cssHeight = viewport.height / dpr;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    page
      .render({ canvasContext: ctx, viewport, canvas })
      .promise.then(() => {
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });

        setSize({ w: cssWidth, h: cssHeight });
        onReady(pageNumber, {
          pdfWidth: baseViewport.width,
          pdfHeight: baseViewport.height,
          displayWidth: cssWidth,
          displayHeight: cssHeight,
        });
      })
      .catch(() => {
        // Ignore aborts (component unmounted mid-render).
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageNumber, scale, onReady]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        aria-label={`Form preview, page ${pageNumber}`}
        className="block bg-white shadow-md"
        role="img"
      />
      {/* Overlays for this page (children passed by parent). Sized to match
       *  the canvas via the wrapper's natural inline-block dimensions. */}
      {size ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ height: size.h, width: size.w }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type FormCanvasProps = {
  pdfUrl: string;
  scale?: number;
  /** Returns the overlay JSX for a given page. Called per-page so each
   *  page's overlay can read that page's `RenderedPageInfo`. */
  renderOverlay?: (pageNumber: number) => React.ReactNode;
  onPageReady: (pageNumber: number, info: RenderedPageInfo) => void;
};

export function FormCanvas({
  pdfUrl,
  scale = 1.5,
  renderOverlay,
  onPageReady,
}: FormCanvasProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let localDoc: PDFDocumentProxy | null = null;

    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist");
        const { PDFJS_WORKER_SRC } = await import(
          "@/lib/client/pdf-editor/pdfjs-worker"
        );

        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

        localDoc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setPdf(localDoc);

        const loaded: PDFPageProxy[] = [];

        for (let i = 1; i <= localDoc.numPages; i++) {
          loaded.push(await localDoc.getPage(i));
          if (cancelled) return;
        }
        setPages(loaded);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load PDF");
      }
    }

    load();

    return () => {
      cancelled = true;
      localDoc?.destroy().catch(() => {});
    };
  }, [pdfUrl]);

  if (error) {
    return <p className="px-4 py-8 text-center text-sm text-danger">{error}</p>;
  }

  if (!pdf || pages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-default-500">Loading form…</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {pages.map((page, idx) => {
        const pageNumber = idx + 1;

        return (
          <PdfPage
            key={pageNumber}
            page={page}
            pageNumber={pageNumber}
            scale={scale}
            onReady={onPageReady}
          >
            {renderOverlay?.(pageNumber)}
          </PdfPage>
        );
      })}
    </div>
  );
}
