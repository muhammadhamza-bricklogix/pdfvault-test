"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";

type ViewerClientProps = {
  bytesUrl: string;
  name: string;
  /**
   * The share token. Used to pre-flight `/api/share/resolve` from the
   * BROWSER so the `share_view` cookie's `Set-Cookie` header actually
   * reaches the user agent. Server-side fetches from `page.tsx` don't
   * propagate Set-Cookie back to the outer page response in Next.js, so
   * for password-less shares the cookie never gets minted from the
   * server path — only from this client-side pre-flight (or, for
   * password-protected shares, from the PasswordGate's verify call).
   */
  token: string;
};

/**
 * Read-only PDF viewer for the public share page.
 *
 * - No Fabric overlay, no editing, no Save — strictly view-and-paginate.
 * - Reuses `loadPdfJs()` so the Safari polyfills + legacy build path
 *   apply here too (the `ReadableStream[Symbol.asyncIterator]` fix is
 *   in there, so this viewer benefits from it automatically).
 * - Renders pages on demand into a single canvas (current page) plus a
 *   prev/next pager. Could be extended to render every page in a
 *   scroll view; kept lean for the MVP.
 */
export function ViewerClient({
  bytesUrl,
  name,
  token,
}: ViewerClientProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "error" | "forbidden"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load the PDF once.
  useEffect(() => {
    let cancelled = false;
    let task: { destroy?: () => void } | null = null;

    const load = async (): Promise<void> => {
      try {
        // Pre-flight resolve from the BROWSER so the `share_view` cookie
        // actually lands. Next.js server-side `fetch` doesn't propagate
        // Set-Cookie back to the outer page response, so this is the
        // only path that mints the cookie for password-less shares.
        // Idempotent: for password-protected shares, PasswordGate has
        // already minted the cookie and this just refreshes it.
        await fetch(`/api/share/resolve?t=${encodeURIComponent(token)}`, {
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => undefined);

        const res = await fetch(bytesUrl, {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (res.status === 401) {
          if (!cancelled) setLoadState("forbidden");

          return;
        }
        if (!res.ok) {
          if (!cancelled) {
            setLoadState("error");
            setErrorMessage(`Failed to load PDF (status ${res.status})`);
          }

          return;
        }
        const buf = await res.arrayBuffer();

        if (cancelled) return;
        const pdfjs = await loadPdfJs();

        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        const t = pdfjs.getDocument({ data: buf });

        task = t;
        const doc = await t.promise;

        if (cancelled) {
          doc.destroy();

          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setLoadState("ready");
      } catch (err) {
        if (!cancelled) {
          setLoadState("error");
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      docRef.current?.destroy().catch(() => undefined);
      docRef.current = null;
      task?.destroy?.();
    };
  }, [bytesUrl, token]);

  // Render the current page whenever it changes.
  const renderPage = useCallback(async (): Promise<void> => {
    const doc = docRef.current;
    const canvas = canvasRef.current;

    if (!doc || !canvas) return;
    const page = await doc.getPage(currentPage);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const baseVp = page.getViewport({ scale: 1 });
    // Fit width to the canvas's surrounding container.
    const containerWidth = canvas.parentElement?.clientWidth ?? baseVp.width;
    const cssScale = Math.min(containerWidth / baseVp.width, 2);
    const viewport = page.getViewport({ scale: cssScale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  }, [currentPage]);

  useEffect(() => {
    if (loadState !== "ready") return;
    void renderPage();
  }, [loadState, renderPage]);

  if (loadState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-default-600">
        Loading PDF…
      </main>
    );
  }
  if (loadState === "forbidden") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-default-600">
          Your session for this link has expired or never authorized. Reload the
          page and re-enter the password.
        </p>
      </main>
    );
  }
  if (loadState === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Couldn&apos;t open this PDF</h1>
        {errorMessage && (
          <p className="text-sm text-default-500">{errorMessage}</p>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-default-100 pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-default-200 bg-background/95 px-4 py-3 backdrop-blur-md">
        <h1 className="truncate text-sm font-medium" title={name}>
          {name}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            className="rounded px-2 py-1 text-default-600 disabled:opacity-40"
            disabled={currentPage <= 1}
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            ←
          </button>
          <span className="tabular-nums">
            {currentPage} / {pageCount}
          </span>
          <button
            className="rounded px-2 py-1 text-default-600 disabled:opacity-40"
            disabled={currentPage >= pageCount}
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
          >
            →
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pt-4">
        <div className="w-full overflow-x-auto shadow-lg">
          <canvas
            ref={canvasRef}
            aria-label={`Page ${currentPage} of ${pageCount}`}
            role="img"
          />
        </div>
      </div>
    </main>
  );
}
