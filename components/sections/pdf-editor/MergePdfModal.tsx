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
import { Button, Modal } from "@heroui/react";
import { useCallback, useRef, useState } from "react";

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
import { usePdfEditorStore } from "@/lib/client/stores";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extras, setExtras] = useState<MergeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const handleAddFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);

      e.target.value = "";
      if (!files.length) return;

      setIsLoading(true);
      try {
        const loaded = await Promise.all(files.map(fileToMergeEntry));

        setExtras((prev) => [...prev, ...loaded]);
      } catch (err) {
        toast.error({
          title: "Couldn't read file",
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

    setIsMerging(true);
    try {
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

      // Bake the live Fabric edits into an IN-MEMORY buffer — no cloud
      // upload, no `store.file` swap, no pdf.js reload. Editor session
      // state (Fabric overlays, live canvas) stays exactly as-is so the
      // user's visible edits don't vanish after the merge finishes.
      // QA 2026-09-07: the previous `editor:save-before-action` fired
      // here caused two full reload cycles per Merge & Download click
      // and users reported their edits disappearing from the editor
      // after the modal closed. The `editor:build-current-bytes` event
      // reads live `fabricCanvas` via `useSaveEditor`'s ref and returns
      // baked bytes via callback — no side effects on the store.
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

      // QA 2026-09-07 (revised): the earlier auto-load-into-composer
      // step (setCurrentDocument(null) + clearFile + setFile(mergedFile))
      // wiped `fabricJsonByPage` and forced a full pdf.js reload —
      // users reported "my edits are lost after refresh" because
      // the reload clobbered the in-session Fabric state before they
      // had a chance to keep working on the SAME editor. Reverted:
      // just download and close the modal. Editor keeps its current
      // file + all Fabric overlays intact. The user's merged copy
      // lives in their downloads folder if they want to re-open it.
      toast.success({
        title: "Merge complete",
        description: `Downloaded ${outName}.`,
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
    }
  }, [source, extras, onClose]);

  const allEntries = source ? [source, ...extras] : extras;
  const totalPages = allEntries.reduce((n, e) => n + e.pageCount, 0);
  const canMerge = !isMerging && !!source && extras.length > 0;

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
