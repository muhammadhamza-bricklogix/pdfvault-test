"use client";

import { useEffect, useMemo, useState } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

// pdf.js range-request chunk size — 64 KB is a good balance between the number
// of round-trips needed to parse a PDF's cross-reference table and the wasted
// bytes when fetching small pages.
const RANGE_CHUNK_SIZE = 65536;

export function usePdfLoader() {
  const file = usePdfEditorStore((s) => s.file);
  const pdfSourceUrl = usePdfEditorStore((s) => s.pdfSourceUrl);
  const setPdfDocument = usePdfEditorStore((s) => s.setPdfDocument);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable key that changes only when the source document actually changes.
  //
  // When a cloud document opens:
  //   1. `pdfSourceUrl` is set first  → sourceKey = the URL  → effect runs
  //   2. `file` arrives later (bg DL) → sourceKey unchanged  → no re-load
  //
  // After Save (applyPostSaveReset clears pdfSourceUrl and sets a new File):
  //   sourceKey = "<name>:<size>:<lastModified>" → effect re-runs → ArrayBuffer load
  //
  // Local drops: pdfSourceUrl is always null → sourceKey = file identity
  const sourceKey = useMemo<string | null>(() => {
    if (pdfSourceUrl) return pdfSourceUrl;
    if (file) return `${file.name}:${file.size}:${file.lastModified}`;

    return null;
  }, [pdfSourceUrl, file]);

  useEffect(() => {
    if (!sourceKey) return;

    let cancelled = false;
    let loadingTask: any = null;

    // Non-save reloads (initial open, restore-version, Manage Pages,
    // opening a different doc) still clear pdfDocument up front — the
    // usePageRenderer / useFabricCanvas cycle depends on that transition
    // to remount cleanly. Save-reloads (post `applyPostSaveReset`) skip
    // this: they set `postSaveReloadPending = true` first, and the
    // Fabric-reload handler in `PdfViewerCanvas` swaps overlays via
    // `loadFromJSON` AFTER the new render lands. Keeping the old
    // pdfDocument alive during the load eliminates the visible "pdf
    // refreshes after save" flicker — the pre-save render stays on
    // screen the whole time, then flips atomically to the new content
    // once `setPdfDocument(doc)` fires below.
    const isSaveReload = usePdfEditorStore.getState().postSaveReloadPending;

    if (!isSaveReload) setPdfDocument(null, 0);

    const load = async () => {
      setIsLoading(true);
      setError(null);

      const usingUrl = Boolean(pdfSourceUrl);

      logger.info("[PDFedits] load: start", {
        mode: usingUrl ? "url-range" : "arraybuffer",
        name: file?.name,
        size: file?.size,
        type: file?.type,
      });

      try {
        // loadPdfJs installs Safari polyfills and loads the legacy build.
        // See lib/client/pdf-editor/load-pdfjs.ts and pdfjs-polyfills.ts.
        const pdfjs = await loadPdfJs();

        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

        if (cancelled) return;

        if (usingUrl) {
          // URL-first path: pdf.js uses HTTP range requests so only the bytes
          // needed for the current page are fetched. The editor becomes
          // interactive after the first 1–3 range requests instead of waiting
          // for the full file download.
          loadingTask = pdfjs.getDocument({
            url: pdfSourceUrl!,
            rangeChunkSize: RANGE_CHUNK_SIZE,
            fontExtraProperties: true,
            disableRange: false,
            disableStream: false,
          });
        } else {
          // ArrayBuffer path: local drops, IDB-restored docs, post-save reloads.
          if (!file) return;
          const arrayBuffer = await file.arrayBuffer();

          if (cancelled) return;

          loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            fontExtraProperties: true,
          });
        }

        const doc = await loadingTask.promise;

        if (cancelled) {
          doc.destroy();

          return;
        }

        logger.info("[PDFedits] load: ok", {
          mode: usingUrl ? "url-range" : "arraybuffer",
          pages: doc.numPages,
        });
        setPdfDocument(doc, doc.numPages);
      } catch (err) {
        logger.error("[PDFedits] load: failed", err);

        if (!cancelled) {
          const name = (err as { name?: string })?.name;

          if (name === "PasswordException") {
            setError(
              "This PDF is password-protected. Remove the password from the PDF and try again.",
            );
          } else if (name === "InvalidPDFException") {
            setError("This file is not a valid PDF or appears to be corrupt.");
          } else {
            setError(err instanceof Error ? err.message : "Failed to load PDF");
          }
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
      // Same guard as the mount branch above — save-reloads swap the
      // pdfDocument atomically via `setPdfDocument(newDoc)` inside the
      // `load` async body; nulling it here would introduce the exact
      // gap we're avoiding. Non-save reloads still null so the next
      // effect run starts from a clean slate.
      if (!usePdfEditorStore.getState().postSaveReloadPending) {
        setPdfDocument(null, 0);
      }
    };
    // sourceKey changes when pdfSourceUrl or file identity changes.
    // pdfSourceUrl is captured via closure inside the effect; we don't list it
    // directly to avoid the double-load when both pdfSourceUrl and file change
    // in the same render cycle.
  }, [sourceKey, setPdfDocument]);

  return { error, isLoading };
}
