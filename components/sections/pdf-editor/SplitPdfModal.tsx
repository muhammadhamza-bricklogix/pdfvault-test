"use client";

import {
  Button,
  Input,
  Label,
  Modal,
  Separator,
  TextField,
} from "@heroui/react";
import {
  CheckmarkCircle02Icon,
  DocumentCodeIcon,
  Loading03Icon,
  Scissor01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useMemo, useState } from "react";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import {
  buildEveryNRanges,
  buildZip,
  type PageRange,
  parseRanges,
  splitPdf,
  type SplitMode,
  triggerDownload,
} from "@/lib/client/pdf-tools/split-pdf";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type SplitPdfModalSource = {
  filename: string;
  bytes: Uint8Array;
  pageCount: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-read source for the loaded editor doc. Caller fetches once on
   *  click; modal is a pure controlled view from there. */
  source: SplitPdfModalSource | null;
};

/**
 * Split the currently-open editor document into multiple PDFs.
 *
 * The modal is a controlled view — caller supplies the bytes + page
 * count via the `source` prop (read once in the menu click handler).
 * Output is the same as the standalone `/tools/split-pdf` route: single
 * range → plain PDF download, multiple → zip.
 *
 * Unsaved edits are NOT baked in. The caller passes the editor store's
 * source bytes (`file`), so any Fabric overlays the user added in-session
 * remain in the editor but won't appear in the split output. The banner
 * inside the modal warns about this when `hasUnsavedChanges` is true.
 * Routing through `buildEditedPdfBytes` would require a shell-level hook
 * with the live `fabricCanvas` ref (see skill-log 2026-06-10 (f)) —
 * acceptable to defer for v1.
 */
export function SplitPdfModal({ isOpen, onClose, source }: Props) {
  const hasUnsavedChanges = usePdfEditorStore((s) => s.hasUnsavedChanges);

  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangesText, setRangesText] = useState("");
  const [chunkSize, setChunkSize] = useState("5");
  const [isSplitting, setIsSplitting] = useState(false);

  // Reset input when the source file changes (modal re-opens for a new
  // doc). Adjusts during render — the discriminator is the source ref so
  // every new file resets ranges + chunkSize back to defaults exactly
  // once. Idiomatic React pattern documented as "adjust state on prop
  // change" in the React 19 docs.
  const [lastSourceKey, setLastSourceKey] = useState<string | null>(null);
  const currentSourceKey = source
    ? `${source.filename}|${source.bytes.byteLength}|${source.pageCount}`
    : null;

  if (currentSourceKey !== lastSourceKey) {
    setLastSourceKey(currentSourceKey);
    setRangesText("");
    setChunkSize("5");
  }

  const pageCount = source?.pageCount ?? 0;

  const parsed = useMemo<
    { ok: true; ranges: PageRange[] } | { ok: false; error: string } | null
  >(() => {
    if (!source) return null;

    if (mode === "ranges") {
      if (rangesText.trim() === "") return null;

      return parseRanges(rangesText, pageCount);
    }

    if (!chunkSize.trim()) return null;

    return buildEveryNRanges(pageCount, Number(chunkSize));
  }, [source, pageCount, mode, rangesText, chunkSize]);

  const handleSplit = useCallback(async () => {
    if (!source) return;
    if (!parsed || !parsed.ok) return;

    setIsSplitting(true);
    try {
      // QA 2026-09-06: split is 100% client-side (pdf-lib), so no
      // axios `isGatedRequest` interceptor ever fires — a signed-in
      // but non-entitled user could split + download freely, bypassing
      // billing. Mirrors the MergePdfModal entitlement gate: check
      // fresh entitlement, and if the user isn't entitled, open the
      // paywall with a preview. User cancels → silent bail (no
      // download, no error toast). User pays → entitlement flips,
      // proceed to split. Signed-out users are routed through
      // AuthModal by `usePaywall`'s bus handler.
      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const dotForPreview = source.filename.lastIndexOf(".");
        const baseForPreview =
          dotForPreview > 0
            ? source.filename.slice(0, dotForPreview)
            : source.filename;
        const previewName = `${baseForPreview}-split.pdf`;
        const outcome = await requestPaywall({
          filename: previewName,
          sourceExt: "pdf",
          targetExt: "pdf",
        });

        if (outcome !== "success") {
          setIsSplitting(false);

          return;
        }
      }

      const parts = await splitPdf(
        source.bytes,
        source.filename,
        parsed.ranges,
      );

      if (parts.length === 1) {
        const only = parts[0]!;

        triggerDownload(
          new Blob([new Uint8Array(only.bytes)], {
            type: "application/pdf",
          }),
          only.filename,
        );
      } else {
        const dot = source.filename.lastIndexOf(".");
        const base = dot > 0 ? source.filename.slice(0, dot) : source.filename;
        const zipName = `${base || "document"}-split.zip`;
        const zip = await buildZip(parts, source.filename);

        triggerDownload(zip, zipName);
      }

      toast.success({
        title: "Split complete",
        description:
          parts.length === 1
            ? `Downloaded ${parts[0]!.filename}.`
            : `Downloaded ${parts.length} files as a zip.`,
      });
      onClose();
    } catch (err) {
      // Silent on PaywallCancelledError — user chose Cancel on the
      // paywall (routed here from a signed-out branch or a stale
      // entitlement retry); no user-facing error, no toast.
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
      logger.error("[split-pdf-modal] split failed", err);
      toast.error({
        title: "Couldn't split this PDF",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSplitting(false);
    }
  }, [source, parsed, onClose]);

  const validationError = parsed && parsed.ok === false ? parsed.error : null;
  const previewRanges = parsed && parsed.ok ? parsed.ranges : null;
  const canSplit =
    !isSplitting && !!source && parsed?.ok === true && parsed.ranges.length > 0;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className="items-start justify-center p-4 sm:items-center">
        <Modal.Dialog className="!max-h-[calc(100dvh-32px)] !w-[92vw] !max-w-[520px] overflow-y-auto overscroll-contain">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Split PDF</Modal.Heading>
          </Modal.Header>

          {/* QA 2026-09-06: page-range input's rounded border was
              clipping on the left inside Modal.Body's default padding.
              Match the CompressModal pattern — explicit `px-4 sm:px-6`
              on Body + `overflow-y-auto` on Dialog — so the input's
              full-width border + focus ring have room and the modal
              scrolls tall content instead of clipping. */}
          <Modal.Body className="space-y-4 px-4 sm:px-6">
            {hasUnsavedChanges && (
              <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-xs text-warning-800">
                You have unsaved edits. They won&apos;t be included in the split
                output — save the document first if you need them baked in.
              </div>
            )}

            {!source && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-default-500">
                <HugeiconsIcon
                  className="animate-spin"
                  icon={Loading03Icon}
                  size={16}
                />
                Reading the PDF…
              </div>
            )}

            {source && (
              <>
                <div className="flex items-center gap-2 text-sm text-default-600">
                  <HugeiconsIcon icon={DocumentCodeIcon} size={16} />
                  <span>
                    <strong>{pageCount}</strong>{" "}
                    {pageCount === 1 ? "page" : "pages"}
                    <span className="ml-2 text-default-400">
                      · {source.filename}
                    </span>
                  </span>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-default-700">
                    How would you like to split it?
                  </span>
                  <div
                    aria-label="Split mode"
                    className="inline-flex w-fit rounded-xl border border-default-200 bg-default-50 p-1"
                    role="tablist"
                  >
                    <button
                      aria-selected={mode === "ranges"}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                        mode === "ranges"
                          ? "bg-content1 text-default-900 shadow"
                          : "text-default-500 hover:text-default-700"
                      }`}
                      role="tab"
                      type="button"
                      onClick={() => setMode("ranges")}
                    >
                      Custom ranges
                    </button>
                    <button
                      aria-selected={mode === "everyN"}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                        mode === "everyN"
                          ? "bg-content1 text-default-900 shadow"
                          : "text-default-500 hover:text-default-700"
                      }`}
                      role="tab"
                      type="button"
                      onClick={() => setMode("everyN")}
                    >
                      Every N pages
                    </button>
                  </div>
                </div>

                {mode === "ranges" ? (
                  <TextField
                    isInvalid={!!validationError}
                    value={rangesText}
                    onChange={setRangesText}
                  >
                    <Label>Page ranges</Label>
                    <Input
                      aria-label="Page ranges"
                      placeholder={`e.g. 1-3, 5, 8-${pageCount}`}
                    />
                  </TextField>
                ) : (
                  <TextField
                    isInvalid={!!validationError}
                    value={chunkSize}
                    onChange={setChunkSize}
                  >
                    <Label>Pages per file</Label>
                    <Input
                      aria-label="Pages per file"
                      inputMode="numeric"
                      placeholder="e.g. 5"
                    />
                  </TextField>
                )}

                {validationError && (
                  <p className="text-sm text-danger-600">{validationError}</p>
                )}

                {previewRanges && previewRanges.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Output ({previewRanges.length}{" "}
                      {previewRanges.length === 1 ? "file" : "files"})
                    </p>
                    <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-default-50 p-3 text-sm">
                      {previewRanges.slice(0, 8).map((r, i) => (
                        <li
                          key={`${r.start}-${r.end}-${i}`}
                          className="flex items-center gap-2 text-default-700"
                        >
                          <HugeiconsIcon
                            className="text-success-500"
                            icon={CheckmarkCircle02Icon}
                            size={14}
                          />
                          <span>
                            Pages {r.start}
                            {r.end !== r.start ? `–${r.end}` : ""}
                          </span>
                        </li>
                      ))}
                      {previewRanges.length > 8 && (
                        <li className="pl-6 text-xs text-default-500">
                          …and {previewRanges.length - 8} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={!canSplit}
              variant="primary"
              onPress={handleSplit}
            >
              {isSplitting ? (
                <span className="flex items-center gap-2">
                  <HugeiconsIcon
                    className="animate-spin"
                    icon={Loading03Icon}
                    size={16}
                  />
                  Splitting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <HugeiconsIcon icon={Scissor01Icon} size={16} />
                  Split &amp; download
                </span>
              )}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
