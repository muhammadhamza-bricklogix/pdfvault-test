"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

import { Button, Modal } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";

type VersionPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Signed URL of the current (live) document bytes. */
  currentUrl: string | null;
  /** Signed URL of the candidate version to restore. */
  versionUrl: string | null;
  /** Display label for the version (e.g. "Version 3"). */
  versionLabel: string;
  /** Loading state while the restore API call is in flight. */
  restoring: boolean;
  /**
   * Fired when the user confirms the restore via the "Restore this
   * version" button. Parent runs the API call and toggles
   * `restoring`; modal closes via `isOpen` once the parent decides.
   */
  onConfirmRestore: () => void | Promise<void>;
};

/**
 * Side-by-side preview of "Current" and the candidate version. Renders
 * page N of each PDF into its own canvas via pdf.js — same load
 * pipeline as the public share viewer (`loadPdfJs()` + polyfills).
 *
 * Layout:
 *   • >= sm  → 2-column grid (current left, version right)
 *   • < sm   → stacked, version below current
 *
 * Lets the user paginate through both PDFs in lockstep so they can
 * scan for differences before committing the restore.
 */
export function VersionPreviewModal({
  isOpen,
  onClose,
  currentUrl,
  versionUrl,
  versionLabel,
  restoring,
  onConfirmRestore,
}: VersionPreviewModalProps): React.ReactElement {
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  // Reset paging whenever the modal opens with a fresh version, using
  // the React-recommended "derive state during render" pattern so we
  // don't fall into the cascading-renders lint trap.
  const [trackedVersion, setTrackedVersion] = useState<string | null>(
    versionUrl,
  );

  if (isOpen && trackedVersion !== versionUrl) {
    setTrackedVersion(versionUrl);
    setPage(1);
  }

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open && !restoring) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[95vw] !max-w-[1200px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Restore {versionLabel} — preview</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-3">
            <p className="text-xs text-default-500">
              Compare your current document with the version you&apos;re about
              to restore. The current state will be saved as a new version so
              you can roll the restore back later if needed.
            </p>

            <div className="flex items-center justify-center gap-2 text-sm">
              <Button
                isDisabled={page <= 1}
                size="sm"
                variant="tertiary"
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                ←
              </Button>
              <span className="tabular-nums text-default-600">
                Page {page}
                {pageCount ? ` of ${pageCount}` : ""}
              </span>
              <Button
                isDisabled={pageCount > 0 && page >= pageCount}
                size="sm"
                variant="tertiary"
                onPress={() =>
                  setPage((p) => (pageCount ? Math.min(pageCount, p + 1) : p))
                }
              >
                →
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PreviewPane
                label="Current"
                page={page}
                url={currentUrl}
                onPageCount={setPageCount}
              />
              <PreviewPane
                label={versionLabel}
                page={page}
                url={versionUrl}
                onPageCount={() => undefined}
              />
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button isDisabled={restoring} slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={restoring || !versionUrl}
              onPress={() => void onConfirmRestore()}
            >
              {restoring ? "Restoring…" : "Restore this version"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

type PreviewPaneProps = {
  /** Heading shown above the canvas. */
  label: string;
  /** Page index to render (1-based). Both panes use the same number. */
  page: number;
  /** Signed URL — null while loading or if unavailable. */
  url: string | null;
  /**
   * Reports the page count back to the parent so the pager bounds the
   * page index. The Current pane drives the pager; the version pane
   * ignores the callback (passes a no-op) so a version with a
   * different page count doesn't fight for control of the pager.
   */
  onPageCount: (count: number) => void;
};

function PreviewPane({
  label,
  page,
  url,
  onPageCount,
}: PreviewPaneProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Reset status to "loading" on URL change via the derive-state-
  // during-render pattern (avoids the set-state-in-effect lint rule).
  const [trackedUrl, setTrackedUrl] = useState<string | null>(url);

  if (trackedUrl !== url) {
    setTrackedUrl(url);
    setStatus("loading");
  }

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let task: { destroy?: () => void } | null = null;

    const run = async (): Promise<void> => {
      try {
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) throw new Error(`status ${res.status}`);
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
        onPageCount(doc.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
      docRef.current?.destroy().catch(() => undefined);
      docRef.current = null;
      task?.destroy?.();
    };
    // onPageCount is intentionally excluded — parent passes a stable
    // setter (useState dispatch). Including it would re-fetch on every
    // re-render.
  }, [url]);

  // Render the requested page into the canvas.
  const renderPage = useCallback(async (): Promise<void> => {
    const doc = docRef.current;
    const canvas = canvasRef.current;

    if (!doc || !canvas) return;
    const safePage = Math.min(Math.max(1, page), doc.numPages);
    const p = await doc.getPage(safePage);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const baseVp = p.getViewport({ scale: 1 });
    const containerWidth = canvas.parentElement?.clientWidth ?? baseVp.width;
    const cssScale = Math.min(containerWidth / baseVp.width, 2);
    const viewport = p.getViewport({ scale: cssScale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;
    await p.render({ canvasContext: ctx, viewport, canvas }).promise;
  }, [page]);

  useEffect(() => {
    if (status !== "ready") return;
    void renderPage();
  }, [status, renderPage]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-xs font-medium text-default-600">
        {label}
      </div>
      <div className="aspect-[3/4] max-h-[55vh] w-full overflow-auto rounded-lg border border-default-200 bg-default-50 p-2">
        {status === "loading" && (
          <p className="flex h-full items-center justify-center text-xs text-default-500">
            Loading…
          </p>
        )}
        {status === "error" && (
          <p className="flex h-full items-center justify-center text-xs text-danger">
            Couldn&apos;t load preview.
          </p>
        )}
        {status === "ready" && (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              aria-label={`${label} preview`}
              className="shadow-sm"
              role="img"
            />
          </div>
        )}
      </div>
    </div>
  );
}
