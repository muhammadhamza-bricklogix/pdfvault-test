"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  DocumentCodeIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuth } from "@clerk/nextjs";
import { Button, Modal } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import {
  fileToMergeEntry,
  mergePdfs,
  type MergeEntry,
} from "@/lib/client/pdf-tools/merge-pdfs";
import {
  clearPendingMergeDownload,
  loadPendingMergeDownload,
  savePendingMergeDownload,
} from "@/lib/client/pdf-tools/pending-merge-download";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { parseLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";
import { triggerDownload } from "@/lib/client/pdf-tools/split-pdf";

type Props = {
  /** Pre-loaded source entry from the editor (position 0, cannot be removed). */
  source: MergeEntry | null;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Merge the currently-open editor PDF with one or more additional PDFs.
 * All work is client-side via pdf-lib — no server round-trip required.
 */
export function MergePdfModal({ isOpen, onClose, source }: Props) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extras, setExtras] = useState<MergeEntry[]>([]);
  const [pendingAutoDownload, setPendingAutoDownload] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  // QA 2026-09-08: `isMerging` is React state — updates are async, so a
  // fast second click on "Merge & download" can slip through the
  // `isDisabled={!canMerge}` gate before the state re-render lands.
  // That fires `mergePdfs` twice and the second run merges [source,
  // ...extras] again on top of the first result → downloaded PDF has
  // the merged content duplicated (user report 2026-09-08: "downloaded
  // PDF file shows the merged file twice"). A ref-based lock is
  // synchronous — the second click hits the guard before touching
  // React state and returns immediately.
  const mergeInFlightRef = useRef(false);
  const pendingAutoStartedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      pendingAutoStartedRef.current = false;

      return;
    }
    if (!source) return;

    let cancelled = false;

    void (async () => {
      try {
        const pending = await loadPendingMergeDownload();

        if (cancelled || !pending) return;

        setExtras(pending.extras);
        setPendingAutoDownload(pending.autoDownload);
      } catch (err) {
        logger.warn("[merge-pdf-modal] pending merge restore failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, source]);

  const buildMergeReturnUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return `${ROUTES.TOOLS.PDF_EDITOR}?tool=merge`;
    }

    const parsed = parseLocalePrefix(window.location.pathname);
    const editorPath = parsed
      ? `/${parsed.locale}${ROUTES.TOOLS.PDF_EDITOR}`
      : ROUTES.TOOLS.PDF_EDITOR;

    return `${editorPath}?tool=merge`;
  }, []);

  const handleAddFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);

      e.target.value = "";
      if (!files.length) return;

      setIsLoading(true);
      try {
        const loaded = await Promise.all(files.map(fileToMergeEntry));

        // QA 2026-09-09: Add PDFs must NOT touch `store.file`. Attached
        // files live only in the modal's `extras` state until the user
        // clicks Merge & Download. The prior inline-merge implementation
        // (via `applyPostSaveReset`) was replacing the editor's source
        // with the concatenated PDF the moment a file was picked, so the
        // composer lost its "actual PDF" view and there was no way to
        // undo the append short of closing the doc. The download flow
        // in `handleMerge` below already bakes the CURRENT source + the
        // extras list at click time, so the final downloaded file has
        // the merged content — no side effects until then.
        setExtras((prev) => [...prev, ...loaded]);
      } catch (err) {
        logger.error("[merge-pdf-modal] add-file failed", err);
        toast.error({
          title: "Couldn't add file",
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const removeExtra = (index: number) =>
    setExtras((prev) => prev.filter((_, i) => i !== index));

  const moveExtra = (index: number, dir: -1 | 1) => {
    setExtras((prev) => {
      const next = [...prev];
      const target = index + dir;

      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];

      return next;
    });
  };

  const handleMerge = useCallback(async () => {
    if (!source) return;
    // Synchronous double-click guard — see `mergeInFlightRef`
    // declaration above for the full rationale.
    if (mergeInFlightRef.current) return;
    mergeInFlightRef.current = true;

    setIsMerging(true);
    try {
      if (!authLoaded) return;

      if (!isSignedIn) {
        const saved = await savePendingMergeDownload(extras, true);

        if (!saved) {
          toast.error({
            title: "Couldn't prepare download",
            description:
              "Keep this tab open and try again. We couldn't preserve the PDFs you added for merge.",
          });

          return;
        }

        await snapshotPendingEditorFile().catch((err) =>
          logger.warn("[merge-pdf-modal] pending editor save failed", err),
        );

        dispatchEmailFirstModal({
          redirectUrl: buildMergeReturnUrl(),
          title: "Your file is ready",
          subtitle: "Create an account to download it",
          submitLabel: "Download file",
        });

        return;
      }

      // QA 2026-09-06: merge is 100% client-side (pdf-lib), so no
      // axios `isGatedRequest` interceptor ever fires — a signed-in
      // but non-entitled user could merge + download freely, bypassing
      // billing. Add an explicit entitlement gate here that mirrors
      // CompressModal / useExportEditor: check fresh entitlement, and
      // if the user isn't entitled, open the paywall with a preview.
      // User cancels → silent bail (no download, no error toast).
      // User pays → entitlement flips, proceed to merge.
      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const dotForPreview = source.filename.lastIndexOf(".");
        const baseForPreview =
          dotForPreview > 0
            ? source.filename.slice(0, dotForPreview)
            : source.filename;
        const previewName = `${baseForPreview}-merged.pdf`;
        const outcome = await requestPaywall({
          filename: previewName,
          sourceExt: "pdf",
          targetExt: "pdf",
        });

        if (outcome !== "success") {
          setIsMerging(false);

          return;
        }
      }

      // QA 2026-09-07: cloud-save current edits BEFORE the in-memory
      // bake, so the user's library stays in sync with what they're
      // about to download. `skipReset: true` keeps `store.file` and the
      // live Fabric canvas untouched — no reload, no lost overlays —
      // which is what the 2026-09-07 comment history flagged as the
      // regression to avoid. If the user is signed-out, this is a
      // no-op and we proceed straight to the bake (they can still
      // download locally; the cloud save is best-effort).
      const isSignedInNow = usePdfEditorStore.getState().isSignedIn;

      if (isSignedInNow) {
        await new Promise<void>((resolve) => {
          window.dispatchEvent(
            new CustomEvent("editor:save-before-action", {
              detail: {
                force: true,
                skipReset: true,
                onComplete: () => resolve(),
              },
            }),
          );
        });
      }

      // Bake the live Fabric edits into an IN-MEMORY buffer — no cloud
      // upload (the save above handled that), no `store.file` swap, no
      // pdf.js reload. Editor session state (Fabric overlays, live
      // canvas) stays exactly as-is so the user's visible edits don't
      // vanish after the merge finishes. The `editor:build-current-bytes`
      // event reads live `fabricCanvas` via `useSaveEditor`'s ref and
      // returns baked bytes via callback — no side effects on the store.
      let sourceBytes: Uint8Array | null = null;

      await new Promise<void>((resolve) => {
        window.dispatchEvent(
          new CustomEvent("editor:build-current-bytes", {
            detail: {
              onComplete: (r: {
                ok: boolean;
                bytes?: Uint8Array;
                error?: string;
              }) => {
                if (r.ok && r.bytes) {
                  sourceBytes = r.bytes;
                } else {
                  logger.warn(
                    "[merge-pdf-modal] in-memory bake failed; falling back to captured source.bytes",
                    { error: r.error },
                  );
                  toast.error({
                    title: "Could not include latest edits",
                    description:
                      "Merging with the last saved copy. Save your edits first so the latest changes are included.",
                  });
                }
                resolve();
              },
            },
          }),
        );
      });

      const liveFile = usePdfEditorStore.getState().file;
      // Prefer the freshly-baked in-memory bytes. Fall back to the
      // pre-captured `source` if the bake failed for any reason —
      // still better than blocking the user.
      const freshSource: MergeEntry = sourceBytes
        ? {
            filename: liveFile?.name ?? source.filename,
            bytes: sourceBytes,
            pageCount: source.pageCount,
          }
        : source;
      const entries = [freshSource, ...extras];
      const bytes = await mergePdfs(entries);
      const dot = freshSource.filename.lastIndexOf(".");
      const base =
        dot > 0 ? freshSource.filename.slice(0, dot) : freshSource.filename;
      const outName = `${base}-merged.pdf`;

      // QA 2026-09-07 (post-118b177): passing `bytes.buffer` sends the ENTIRE
      // underlying ArrayBuffer to Blob — if `bytes` is a view (byteOffset > 0
      // OR byteLength < buffer.byteLength), the Blob is corrupt (extra bytes
      // before/after the PDF stream), and readers fall back to displaying
      // only the source-copied page — the exact "edits missing" symptom.
      // Pass the Uint8Array view directly; Blob accepts ArrayBufferView.
      logger.info("[PDFedits] MERGE-DIAG: download bytes", {
        freshBakeUsed: !!sourceBytes,
        freshSourceLen: freshSource.bytes.byteLength,
        freshSourceOffset: freshSource.bytes.byteOffset,
        freshSourceBufferLen: freshSource.bytes.buffer.byteLength,
        extrasCount: extras.length,
        mergedLen: bytes.byteLength,
        mergedOffset: bytes.byteOffset,
        mergedBufferLen: bytes.buffer.byteLength,
      });

      const mergedBlob = new Blob([bytes as BlobPart], {
        type: "application/pdf",
      });

      triggerDownload(mergedBlob, outName);
      await clearPendingMergeDownload();

      // QA 2026-09-09: also swap the composer's source to the merged
      // file so the user's next edit session runs against the combined
      // document. The download above ships the same bytes to disk;
      // we're wiring the SAME bytes into `store.file` via
      // `applyPostSaveReset` so pdf.js reloads with the merged pages
      // and the sidebar shows [source pages + attached pages] as one
      // unified list. Fabric state on source pages 1..N is preserved
      // by `applyPostSaveReset` (see the KEEP fabricJsonByPage comment
      // in `pdf-editor-store.ts`); new pages N+1..N+M come in clean.
      //
      // `markDocumentDirty()` after because the merged bytes aren't
      // cloud-saved yet — user must hit Save to persist to their
      // library.
      //
      // Only runs when the user clicks Merge & Download. The Add PDFs
      // click does NOT touch the composer (per 2026-09-09 revert),
      // so opening the modal + adding files + closing without clicking
      // Merge & Download is a no-op on the editor session.
      const mergedFile = new File(
        [bytes as BlobPart],
        liveFile?.name ?? source.filename,
        { type: "application/pdf" },
      );

      usePdfEditorStore.getState().applyPostSaveReset(mergedFile);
      usePdfEditorStore.getState().markDocumentDirty();

      toast.success({
        title: "Merge complete",
        description: `Downloaded ${outName}. Composer now shows the merged pages.`,
      });
      onClose();
    } catch (err) {
      // Silent on PaywallCancelledError — user chose Cancel on the
      // paywall (routed here from a signed-out branch or a stale
      // entitlement retry); no user-facing error, no toast.
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
      logger.error("[merge-pdf-modal] merge failed", err);
      toast.error({
        title: "Couldn't merge PDFs",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsMerging(false);
      mergeInFlightRef.current = false;
    }
  }, [authLoaded, isSignedIn, source, extras, buildMergeReturnUrl, onClose]);

  useEffect(() => {
    if (!isOpen || !source || !pendingAutoDownload) return;
    if (!authLoaded || !isSignedIn) return;
    if (extras.length === 0) return;
    if (pendingAutoStartedRef.current) return;

    pendingAutoStartedRef.current = true;
    setPendingAutoDownload(false);
    void handleMerge();
  }, [
    authLoaded,
    extras.length,
    handleMerge,
    isOpen,
    isSignedIn,
    pendingAutoDownload,
    source,
  ]);

  const allEntries = source ? [source, ...extras] : extras;
  const totalPages = allEntries.reduce((n, e) => n + e.pageCount, 0);
  const canMerge = authLoaded && !isMerging && !!source && extras.length > 0;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !min-h-[540px] !max-w-[520px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Merge PDFs</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-4">
            {!source && (
              <p className="text-sm text-default-500">No PDF open in editor.</p>
            )}

            {source && (
              <>
                <p className="text-xs text-default-500">
                  The current document is first. Add more PDFs below — they will
                  be appended in order.
                </p>

                <ul className="flex flex-col gap-2">
                  {allEntries.map((entry, i) => {
                    const isSource = i === 0;

                    return (
                      <li
                        key={`${entry.filename}-${i}`}
                        className="flex items-center gap-2 rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-sm"
                      >
                        <HugeiconsIcon
                          className="shrink-0 text-default-400"
                          icon={DocumentCodeIcon}
                          size={16}
                        />
                        <span className="min-w-0 flex-1 truncate text-default-800">
                          {entry.filename}
                        </span>
                        <span className="shrink-0 text-xs text-default-400">
                          {entry.pageCount}{" "}
                          {entry.pageCount === 1 ? "page" : "pages"}
                        </span>
                        {!isSource && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              aria-label="Move up"
                              className="rounded p-0.5 hover:bg-default-200 disabled:opacity-30"
                              disabled={i === 1}
                              type="button"
                              onClick={() => moveExtra(i - 1, -1)}
                            >
                              <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
                            </button>
                            <button
                              aria-label="Move down"
                              className="rounded p-0.5 hover:bg-default-200 disabled:opacity-30"
                              disabled={i === allEntries.length - 1}
                              type="button"
                              onClick={() => moveExtra(i - 1, 1)}
                            >
                              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                            </button>
                            <button
                              aria-label="Remove"
                              className="rounded p-0.5 text-danger-500 hover:bg-danger-50"
                              type="button"
                              onClick={() => removeExtra(i - 1)}
                            >
                              <HugeiconsIcon icon={Delete02Icon} size={14} />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {allEntries.length > 1 && (
                  <p className="text-xs text-default-500">
                    Total: <strong>{totalPages}</strong>{" "}
                    {totalPages === 1 ? "page" : "pages"} across{" "}
                    {allEntries.length} files
                  </p>
                )}

                <input
                  ref={fileInputRef}
                  multiple
                  accept="application/pdf"
                  className="hidden"
                  type="file"
                  onChange={handleAddFiles}
                />

                <Button
                  className="w-full border-2 border-[#f12c23] text-[#f12c23]"
                  isDisabled={isLoading || isMerging}
                  variant="secondary"
                  onPress={() => fileInputRef.current?.click()}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <HugeiconsIcon
                        className="animate-spin"
                        icon={Loading03Icon}
                        size={16}
                      />
                      Reading…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <HugeiconsIcon icon={Add01Icon} size={16} />
                      Add PDFs
                    </span>
                  )}
                </Button>
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={!canMerge}
              variant="primary"
              onPress={handleMerge}
            >
              {isMerging ? (
                <span className="flex items-center gap-2">
                  <HugeiconsIcon
                    className="animate-spin"
                    icon={Loading03Icon}
                    size={16}
                  />
                  Merging…
                </span>
              ) : (
                "Merge & download"
              )}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
