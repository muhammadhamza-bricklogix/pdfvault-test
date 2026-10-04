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
 * - No Fabric overlay, no editing, no Save — strictly view + scroll.
 * - Reuses `loadPdfJs()` so the Safari polyfills + legacy build path
 *   apply here too (the `ReadableStream[Symbol.asyncIterator]` fix is
 *   in there, so this viewer benefits from it automatically).
 * - Renders EVERY page in a vertical scroll list — the previous
 *   one-page-at-a-time pager had tiny prev/next arrows in the header
 *   that recipients missed entirely, so they thought "only 1 page was
 *   shared" even for multi-page PDFs (QA report). Scroll-list matches
 *   Chrome / Safari / Adobe Reader's default and makes the full
 *   document immediately discoverable.
 */
export function ViewerClient({
  bytesUrl,
  name,
  token,
}: ViewerClientProps): React.ReactElement {
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loadState, setLoadState] = useState<
    | "loading"
    | "ready"
    | "error"
    | "forbidden"
    | "expired"
    | "not-found"
    | "pdf-password"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Row 40: after a recipient enters the share-link password, the bytes
  // can still be PDF-password encrypted. ViewerClient previously fell
  // into the generic error branch, which showed "PasswordException" and
  // never prompted for the file's internal password. Prompt the user
  // for it and re-attempt the open.
  const [pdfPassword, setPdfPassword] = useState("");
  const [pdfPasswordAttempt, setPdfPasswordAttempt] = useState<number>(0);
  const [pdfPasswordError, setPdfPasswordError] = useState<string | null>(null);
  const [pdfPasswordPending, setPdfPasswordPending] = useState(false);

  // Load the PDF once per bytes fetch, retried after the user supplies
  // the PDF's own password (pdfPasswordAttempt bumps on each submit).
  useEffect(() => {
    let cancelled = false;
    let task: { destroy?: () => void } | null = null;

    const openWithPdfJs = async (
      pdfjs: Awaited<ReturnType<typeof loadPdfJs>>,
      buf: ArrayBuffer,
      password: string | undefined,
    ): Promise<void> => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      const t = pdfjs.getDocument({
        // Clone so a retry after an incorrect-password rejection keeps
        // the underlying ArrayBuffer intact (pdf.js can detach the one
        // it's handed on failure in some code paths).
        data: buf.slice(0),
        password,
      });

      task = t;
      try {
        const doc = await t.promise;

        if (cancelled) {
          doc.destroy();

          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setLoadState("ready");
        setPdfPasswordPending(false);
      } catch (err) {
        if (cancelled) return;
        const name_ = (err as { name?: string } | null)?.name;
        const code = (err as { code?: number } | null)?.code;

        if (name_ === "PasswordException") {
          // Code 2 = INCORRECT_PASSWORD, 1 = NEED_PASSWORD.
          if (code === 2) {
            setPdfPasswordError("Incorrect password. Try again.");
          } else {
            setPdfPasswordError(null);
          }
          setLoadState("pdf-password");
          setPdfPasswordPending(false);

          return;
        }
        setLoadState("error");
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPdfPasswordPending(false);
      }
    };

    const load = async (): Promise<void> => {
      try {
        // Reuse the cached bytes for retries so we don't double-fetch
        // the share-link bytes on every password attempt.
        let buf = bytesRef.current;

        if (!buf) {
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
          // 410 Gone = token expired OR share revoked by owner.
          if (res.status === 410) {
            if (!cancelled) setLoadState("expired");

            return;
          }
          if (res.status === 404) {
            if (!cancelled) setLoadState("not-found");

            return;
          }
          if (!res.ok) {
            if (!cancelled) {
              setLoadState("error");
              setErrorMessage(`Failed to load PDF (status ${res.status})`);
            }

            return;
          }
          buf = await res.arrayBuffer();
          if (cancelled) return;
          bytesRef.current = buf;
        }
        const pdfjs = await loadPdfJs();

        if (cancelled) return;
        await openWithPdfJs(
          pdfjs,
          buf,
          pdfPassword.length > 0 ? pdfPassword : undefined,
        );
      } catch (err) {
        if (!cancelled) {
          setLoadState("error");
          setErrorMessage(err instanceof Error ? err.message : String(err));
          setPdfPasswordPending(false);
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
  }, [bytesUrl, token, pdfPasswordAttempt]);

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
  if (loadState === "expired") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Link unavailable</h1>
        <p className="text-default-600">
          This share link has expired. Ask the sender to generate a new one.
        </p>
      </main>
    );
  }
  if (loadState === "not-found") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Link unavailable</h1>
        <p className="text-default-600">
          This shared document is no longer available.
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
  if (loadState === "pdf-password") {
    // Row 40: share-link password protects the LINK; a separately-
    // password-protected PDF needs its own password before pdf.js can
    // render it. Prompt the recipient so they can supply it.
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">
          This PDF is password-protected
        </h1>
        <p className="text-center text-sm text-default-600">
          Enter the password set on the PDF itself to view it. This is separate
          from the share-link password.
        </p>
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pdfPassword.length === 0 || pdfPasswordPending) return;
            setPdfPasswordPending(true);
            setPdfPasswordError(null);
            setLoadState("loading");
            setPdfPasswordAttempt((n) => n + 1);
          }}
        >
          <input
            autoFocus
            aria-label="PDF password"
            autoComplete="current-password"
            className={`w-full rounded-md border px-3 py-2 text-sm ${
              pdfPasswordError ? "border-red-500" : "border-default-300"
            }`}
            type="password"
            value={pdfPassword}
            onChange={(e) => {
              setPdfPassword(e.target.value);
              setPdfPasswordError(null);
            }}
          />
          {pdfPasswordError && (
            <p className="text-xs text-red-500">{pdfPasswordError}</p>
          )}
          <button
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={pdfPassword.length === 0 || pdfPasswordPending}
            type="submit"
          >
            {pdfPasswordPending ? "Checking…" : "Open PDF"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-default-100 pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-default-200 bg-background/95 px-4 py-3 backdrop-blur-md">
        <h1 className="truncate text-sm font-medium" title={name}>
          {name}
        </h1>
        <span className="text-sm tabular-nums text-default-500">
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </span>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
          <SharePageCanvas
            key={pageNum}
            docRef={docRef}
            pageCount={pageCount}
            pageNum={pageNum}
          />
        ))}
      </div>
    </main>
  );
}

/**
 * Renders a single PDF page into its own canvas. Extracted so React
 * owns per-page mount / unmount and each page renders independently
 * — a 200-page doc opens the first few visible pages fast instead of
 * blocking on a serial render of everything.
 *
 * Uses IntersectionObserver so pages render lazily as they scroll into
 * view. Pages outside the viewport stay as an empty box sized to the
 * page's aspect ratio so the scrollbar reflects the true document
 * length from the moment the doc loads — no reflow as pages fill in.
 */
function SharePageCanvas({
  docRef,
  pageNum,
  pageCount,
}: {
  docRef: React.RefObject<PDFDocumentProxy | null>;
  pageNum: number;
  pageCount: number;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // Read the page's aspect ratio up front so the placeholder can size
  // itself to the real page dimensions — otherwise every page is a
  // fixed-height box until it renders and the scrollbar jumps.
  useEffect(() => {
    const doc = docRef.current;

    if (!doc) return;
    let cancelled = false;

    void (async () => {
      try {
        const page = await doc.getPage(pageNum);
        const vp = page.getViewport({ scale: 1 });

        if (!cancelled) setAspectRatio(vp.width / vp.height);
      } catch {
        // Silent — the render effect will surface the real error.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docRef, pageNum]);

  const render = useCallback(async (): Promise<void> => {
    if (renderedRef.current) return;
    const doc = docRef.current;
    const canvas = canvasRef.current;

    if (!doc || !canvas) return;
    renderedRef.current = true;

    try {
      const page = await doc.getPage(pageNum);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const baseVp = page.getViewport({ scale: 1 });
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
    } catch {
      renderedRef.current = false; // allow retry on next intersection
    }
  }, [docRef, pageNum]);

  // Lazy render on first intersection with the viewport. `rootMargin`
  // pre-renders a page above and below the visible one so scrolling
  // never lands on a blank canvas mid-flight.
  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;
    if (typeof IntersectionObserver === "undefined") {
      // No IO support (very old Safari) — render eagerly.
      void render();

      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void render();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "800px 0px" },
    );

    io.observe(wrapper);

    return () => io.disconnect();
  }, [render]);

  return (
    <div
      ref={wrapperRef}
      aria-label={`Page ${pageNum} of ${pageCount}`}
      className="w-full overflow-x-auto rounded bg-white shadow-md"
      role="img"
      style={
        aspectRatio
          ? { aspectRatio: `${aspectRatio}`, width: "100%" }
          : undefined
      }
    >
      <canvas ref={canvasRef} className="block h-auto w-full" />
    </div>
  );
}
