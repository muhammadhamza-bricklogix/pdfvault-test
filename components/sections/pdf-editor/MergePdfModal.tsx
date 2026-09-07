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

      // Bake live Fabric edits (draw / sign / shapes / highlights)
      // into `store.file` RIGHT BEFORE the merge fires — regardless
      // of how the modal was opened (toolbar click, hamburger,
      // `?tool=merge` deep-link auto-launch). The pre-open
      // `saveBeforeAction` in HamburgerMenu covers the toolbar/menu
      // path, but the auto-launch path (hydrator directly opens the
      // modal) skips it, so users hitting Merge & Download after
      // drawing on a `?tool=merge` deep-link were shipping unedited
      // bytes (QA 2026-09-07). Doing the save here — always — means
      // ANY entry point results in the current edits being baked
      // before the merge reads the source.
      //
      // Only fire for signed-in users; guests have no cloud account
      // to save to. `useSaveEditor` handles the `not-signed-in` case
      // by dispatching the auth modal — we shouldn't route through
      // that here because the user is already committed to the merge
      // flow and paywall/auth was gated above.
      const { isSignedIn: signedIn } = usePdfEditorStore.getState();

      if (signedIn) {
        const saveOk = await new Promise<boolean>((resolve) => {
          window.dispatchEvent(
            new CustomEvent("editor:save-before-action", {
              detail: {
                force: true,
                skipWait: true,
                onComplete: (r: { ok: boolean }) => resolve(r.ok),
              },
            }),
          );
        });

        // If the save fails (e.g. `pdfDocument` momentarily null),
        // fall through anyway — better to ship the last-known bytes
        // than block the user. The re-read below picks up whatever
        // is current.
        if (!saveOk) {
          logger.warn(
            "[merge-pdf-modal] pre-merge save-before-action failed; merging with current store.file",
          );
        }
      }

      // Re-read the source at merge time from the LIVE store.file
      // instead of trusting `source.bytes` captured at modal-open.
      // After the save above, `store.file` should be the freshly-
      // baked bytes.
      const liveFile = usePdfEditorStore.getState().file;
      const freshSource = liveFile ? await fileToMergeEntry(liveFile) : source;
      const entries = [freshSource, ...extras];
      const bytes = await mergePdfs(entries);
      const dot = freshSource.filename.lastIndexOf(".");
      const base =
        dot > 0 ? freshSource.filename.slice(0, dot) : freshSource.filename;
      const outName = `${base}-merged.pdf`;

      const mergedBlob = new Blob([bytes.buffer as ArrayBuffer], {
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
