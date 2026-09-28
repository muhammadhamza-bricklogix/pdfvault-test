"use client";

import type { CompressPreset } from "@/lib/shared/types/pdf-tools.types";

import { useAuth } from "@clerk/nextjs";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  Label,
  Modal,
  NumberField,
  Slider,
  Switch,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { useCompressFileMutation } from "@/lib/client/query/mutations";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";

type PresetOption = {
  description: string;
  label: string;
  value: Exclude<CompressPreset, "custom">;
};

const PENDING_COMPRESS_STORAGE_KEY = "pdfvault:pendingCompress";
const PENDING_COMPRESS_MAX_AGE_MS = 30 * 60 * 1000;

type PendingCompressConfig = {
  preset: CompressPreset;
  quality: number;
  maxImageDpi: number;
  grayscale: boolean;
  ts: number;
};

function readPendingCompress(): PendingCompressConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_COMPRESS_STORAGE_KEY);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCompressConfig;

    if (Date.now() - parsed.ts > PENDING_COMPRESS_MAX_AGE_MS) {
      window.sessionStorage.removeItem(PENDING_COMPRESS_STORAGE_KEY);

      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function savePendingCompress(config: Omit<PendingCompressConfig, "ts">): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PENDING_COMPRESS_STORAGE_KEY,
      JSON.stringify({ ...config, ts: Date.now() }),
    );
  } catch {
    // sessionStorage disabled in private mode — ignore.
  }
}

function clearPendingCompress(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_COMPRESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const PRESET_OPTIONS: ReadonlyArray<PresetOption> = [
  {
    label: "High quality",
    description:
      "Best for print — minor size reduction, near-original fidelity.",
    value: "high",
  },
  {
    label: "Balanced",
    description: "Good for most documents — solid size cut at viewing quality.",
    value: "balanced",
  },
  {
    label: "Light",
    description: "Smallest file — 72 DPI, best for email and web sharing.",
    value: "light",
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function CompressModal() {
  const isOpen = usePdfEditorStore((s) => s.isCompressModalOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsCompressModalOpen);
  const file = usePdfEditorStore((s) => s.file);
  const { isSignedIn } = useAuth();

  // Seed state from any pending compress config saved by a prior signed-out
  // "Compress & download" click (see the signed-out branch of
  // `handleCompress`). Lets the auto-fire effect below run the mutation with
  // the exact preset + custom knobs the user originally chose, without having
  // to setState-then-defer.
  const [preset, setPreset] = useState<CompressPreset>(
    () => readPendingCompress()?.preset ?? "balanced",
  );
  const [quality, setQuality] = useState(
    () => readPendingCompress()?.quality ?? 75,
  );
  const [maxImageDpi, setMaxImageDpi] = useState(
    () => readPendingCompress()?.maxImageDpi ?? 150,
  );
  const [grayscale, setGrayscale] = useState(
    () => readPendingCompress()?.grayscale ?? false,
  );

  const compress = useCompressFileMutation();
  const autoFireRef = useRef(false);
  // Live ref so the auto-fire effect can invoke `handleCompress` without
  // pulling it into the dep array (the callback captures fresh state on
  // each render anyway).
  const handleCompressRef = useRef<() => Promise<void>>(async () => {});

  const handleClose = () => {
    if (compress.isPending) return;
    setIsOpen(false);
  };

  const handleCompress = async () => {
    if (!file) return;

    // Sign-in gate — mirror the export flow. Guests can open + edit
    // the PDF, but the compress endpoint is auth+paywall gated on the
    // backend, so route them through the sign-in confirm modal first
    // (the paywall's checkout intent needs auth). After sign-in the
    // user returns to the same editor with `?tool=compress` set, so
    // the compress modal re-opens automatically via the hydrator.
    if (!isSignedIn) {
      // Snapshot file + fabric edits + extractedPages so the hydrator
      // restores overlays too — file-only save loses in-progress edits
      // on return ("first-time login drops my edits" bug).
      await snapshotPendingEditorFile().catch((err) =>
        logger.warn("pending editor file save failed", err),
      );

      // Persist the user's preset selection so the auto-fire effect on
      // return can run compress with the same config — the modal must
      // NOT ask them to pick again (QA 2026-09-14).
      savePendingCompress({ preset, quality, maxImageDpi, grayscale });

      const returnTo = `${ROUTES.TOOLS.PDF_EDITOR}?tool=compress`;

      // Email-first modal so NEW-email users auto-signup instead of
      // dead-ending at "We couldn't find an account with that email"
      // on the login form (QA 2026-09-06). Cards finalize with
      // `window.location.assign(returnTo)`; hydrator re-opens the
      // compress modal via step #4 on return.
      //
      // Copy matches the Done → Download flow in `use-export-editor.ts`
      // (QA 2026-09-12: "The compress modal is different; it should be
      // the same. 'Your file is ready'"). Keeps guest-tool prompts
      // consistent across compress / export / any other pre-signup gate
      // that funnels through the same downstream auth chain.
      dispatchEmailFirstModal({
        redirectUrl: returnTo,
        title: "Your file is ready",
        subtitle: "Create an account to download it",
        submitLabel: "Download file",
      });

      setIsOpen(false);

      return;
    }

    // Paywall gate — fires BEFORE the CPU-heavy mutation so the modal
    // doesn't stack on the compress busy-state. `ensureFreshEntitlement`
    // forces a network read when the snapshot is `false` — otherwise a
    // freshly-signed-in user whose subscription query hasn't landed
    // yet would hit the paywall despite being subscribed. Axios
    // interceptor stays as the safety net for stale snapshots later.
    const entitled = await ensureFreshEntitlement();

    if (!entitled) {
      const outcome = await requestPaywall();

      if (outcome !== "success") {
        // User dismissed the paywall — silent bail-out.
        return;
      }
    }

    try {
      // Bake Fabric overlays into the PDF bytes before compressing so
      // any edits (draw, highlight, text, signature, etc.) are included
      // in the compressed output. Uses `editor:build-current-bytes` with
      // `bakeOverlays: true` so the shell's useSaveEditor (which holds
      // the live fabricCanvas ref) does the bake — CompressModal has no
      // canvas access. Falls back to `store.file` if the bake event is
      // unhandled (e.g. editor not mounted).
      const bakedBytes = await new Promise<Uint8Array | null>((resolve) => {
        window.dispatchEvent(
          new CustomEvent("editor:build-current-bytes", {
            detail: {
              bakeOverlays: true,
              onComplete: (r: { ok: boolean; bytes?: Uint8Array }) => {
                resolve(r.ok && r.bytes ? r.bytes : null);
              },
            },
          }),
        );
      });

      const fileToCompress = bakedBytes
        ? new File([bakedBytes as BlobPart], file.name, {
            type: "application/pdf",
          })
        : file;

      const result = await compress.mutateAsync({
        file: fileToCompress,
        preset,
        ...(preset === "custom" ? { quality, maxImageDpi, grayscale } : {}),
      });

      triggerBlobDownload(result.blob, result.fileName);
      setIsOpen(false);
    } catch (err) {
      // Axios interceptor throws PaywallCancelledError when the user
      // dismisses the payment modal on a 402/403 retry — that's a user
      // choice, not an error worth toasting. The mutation's own
      // onError still surfaces the toast for other HTTP failures.
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
    }
  };

  useEffect(() => {
    handleCompressRef.current = handleCompress;
  });

  // Post-signin auto-fire (QA 2026-09-14). If the user clicked "Compress
  // & download" as a guest we saved their preset to sessionStorage and
  // dispatched the email-first modal. When they return signed-in with
  // `?tool=compress`, the hydrator's Step 4 SKIPS opening this modal
  // (see the pending-config check in `pending-editor-file-hydrator.tsx`)
  // and this effect resumes compression with the exact same config, no
  // second popup, no second click. Clears the sessionStorage key on
  // fire so a reload / retry doesn't loop.
  useEffect(() => {
    if (autoFireRef.current) return;
    if (!isSignedIn || !file) return;
    if (!readPendingCompress()) return;
    autoFireRef.current = true;
    clearPendingCompress();
    void handleCompressRef.current();
  }, [isSignedIn, file]);

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Container className="items-start justify-center p-4 sm:items-center">
        <Modal.Dialog className="!max-h-[calc(100dvh-32px)] !w-[92vw] !max-w-[520px] overflow-y-auto overscroll-contain">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Compress PDF</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-5 px-4 sm:px-6">
            <div className="space-y-2">
              <p className="text-xs text-default-500">
                {file
                  ? `Current size — ${formatBytes(file.size)} • ${file.name}`
                  : "Open a PDF before compressing."}
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--color-foreground)]">
                Quality preset
              </legend>

              <div className="flex flex-col gap-2 px-2">
                {PRESET_OPTIONS.map((opt) => {
                  const checked = preset === opt.value;

                  return (
                    <button
                      key={opt.value}
                      aria-pressed={checked}
                      className={`flex flex-col rounded-lg border p-3 text-left transition ${
                        checked
                          ? "border-accent bg-accent/5 ring-2 ring-accent"
                          : "border-default-200 hover:bg-default-50"
                      }`}
                      type="button"
                      onClick={() => setPreset(opt.value)}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-default-500">
                        {opt.description}
                      </span>
                    </button>
                  );
                })}

                <button
                  aria-pressed={preset === "custom"}
                  className={`flex flex-col rounded-lg border p-3 text-left transition ${
                    preset === "custom"
                      ? "border-accent bg-accent/5 ring-2 ring-accent"
                      : "border-default-200 hover:bg-default-50"
                  }`}
                  type="button"
                  onClick={() => setPreset("custom")}
                >
                  <span className="text-sm font-medium">Custom</span>
                  <span className="text-xs text-default-500">
                    Fine-tune image quality, downsample DPI, or force grayscale.
                  </span>
                </button>
              </div>
            </fieldset>

            {preset === "custom" && (
              <div className="space-y-4 rounded-lg border border-default-200 p-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-xs text-default-500">
                      Image quality
                    </Label>
                    <span className="text-xs font-medium">{quality}</span>
                  </div>
                  <Slider
                    aria-label="Image quality"
                    className="p-1"
                    maxValue={100}
                    minValue={1}
                    step={1}
                    value={quality}
                    onChange={(v) => setQuality(v as number)}
                  >
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-default-500">
                    Max image DPI (downsamples larger images)
                  </Label>
                  <NumberField
                    aria-label="Max image DPI"
                    className="w-32"
                    maxValue={600}
                    minValue={36}
                    step={1}
                    value={maxImageDpi}
                    onChange={(v) => {
                      if (Number.isFinite(v)) setMaxImageDpi(v);
                    }}
                  >
                    <NumberField.Group>
                      <NumberField.DecrementButton>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                      </NumberField.DecrementButton>
                      <NumberField.Input />
                      <NumberField.IncrementButton>
                        <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
                      </NumberField.IncrementButton>
                    </NumberField.Group>
                  </NumberField>
                </div>

                <Switch
                  isSelected={grayscale}
                  size="sm"
                  onChange={() => setGrayscale((v) => !v)}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    <Label className="text-sm">Convert to grayscale</Label>
                  </Switch.Content>
                </Switch>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              isDisabled={compress.isPending}
              slot="close"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              isDisabled={!file || compress.isPending}
              onPress={() => void handleCompress()}
            >
              {compress.isPending ? "Compressing…" : "Compress & download"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
