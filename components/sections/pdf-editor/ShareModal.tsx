"use client";

import { Button, Input, Label, Modal, Switch, TextField } from "@heroui/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { createShare } from "@/lib/client/api/shares";
import { normalizeW9ValuesForFinalize } from "@/lib/client/forms/normalize-w9-values";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { stripLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

type ExpiryPreset = "1d" | "7d" | "30d";

const EXPIRY_PRESETS: { id: ExpiryPreset; label: string; ms: number }[] = [
  { id: "1d", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

// Mounted at shell level (not inside HamburgerMenu) so that the modal
// state survives the EditorLayout remount that fires during the
// post-save pdf.js reload. Previously the local `useState(false)` in
// HamburgerMenu was wiped when `applyPostSaveReset` swapped `store.file`
// → `usePdfLoader` cleared `pdfDocument` → EditorLayout returned
// `<EditorLoadingShell />` → HamburgerMenu unmounted → `setIsShareOpen(true)`
// hit a stale instance. Store-backed open state fixes that.
export function ShareModal(): React.ReactElement {
  const file = usePdfEditorStore((s) => s.file);
  const isOpen = usePdfEditorStore((s) => s.isShareModalOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsShareModalOpen);
  const pathname = usePathname();
  // The W-9 editor stamps values via the backend finalize endpoint
  // (see `W9FinalizeIntercept`), NOT via the standard editor save
  // pipeline. `store.file` on that route is always the blank IRS
  // template, so sharing it directly would ship the recipient a blank
  // form. Detect the route and, on generate, run finalize first + swap
  // the file for the stamped bytes before uploading to /api/share.
  //
  // Match all four W-9 URLs — the short marketing URL (`/w-9-form`)
  // is where most users land, but `/forms/w-9`, `/forms/w-9/edit` and
  // `/w9-form` all mount the same editor with the same
  // `useFormEditorStore` session, so Share from any of them needs
  // finalize. Strip the locale prefix (`/de/`, `/fr/`, etc.) before
  // comparing — otherwise Share on `/de/w-9-form` would skip the
  // finalize step and ship a blank template (QA 2026-09-06 pattern).
  const strippedPath = stripLocalePrefix(pathname);
  const isW9Route =
    strippedPath === ROUTES.FORMS.W9_SHORT ||
    strippedPath === ROUTES.FORMS.W9_FORM ||
    strippedPath === ROUTES.FORMS.W9 ||
    strippedPath.startsWith(ROUTES.FORMS.W9_EDIT);
  const onClose = (): void => setIsOpen(false);
  const [expiry, setExpiry] = useState<ExpiryPreset>("7d");
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [generated, setGenerated] = useState<{
    url: string;
    expiresAt: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [revealPassword, setRevealPassword] = useState(false);

  const reset = (): void => {
    setExpiry("7d");
    setWithPassword(false);
    setPassword("");
    setGenerated(null);
    setSubmitting(false);
    setCopyState("idle");
    setRevealPassword(false);
  };

  const close = (): void => {
    reset();
    onClose();
  };

  const onGenerate = async (): Promise<void> => {
    if (!file) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before creating a share link.",
      });

      return;
    }
    if (withPassword && (password.length < 4 || password.length > 128)) {
      toast.error({
        title: "Invalid password",
        description: "Password must be 4–128 characters.",
      });

      return;
    }

    const ms = EXPIRY_PRESETS.find((p) => p.id === expiry)?.ms ?? 0;
    const expiresAt = Date.now() + ms;

    setSubmitting(true);

    // W-9 flow: stamp the form values via the backend finalize
    // endpoint, fetch the stamped bytes, and share THOSE — otherwise
    // the recipient sees the blank IRS template. The standard editor
    // save pipeline doesn't run here because form values live in
    // `useFormEditorStore` (backend stamps them at finalize time), not
    // in `fabricJsonByPage`.
    //
    // Standard editor flow: `store.file` is the cloud-Save output,
    // which uses `bakeOverlays: false` — watermark + background image
    // intentionally NOT baked in (they'd stack on every save). To
    // include them in the share, dispatch `editor:share-bake` and let
    // `useShareBaker` (shell-level, has live fabricCanvas ref) run
    // `buildEditedPdfBytes({ bakeOverlays: true })`. QA 2026-09-09:
    // recipients were seeing text/shape edits but no watermark or bg
    // image.
    let fileToShare = file;
    let shareName = file.name;

    if (!isW9Route) {
      // Standard-editor path — bake overlays via the shell-level hook.
      // On any failure, fall back to `store.file` (the unbaked cloud
      // save) so the share still generates rather than blocking the
      // user; toast tells them what's missing.
      try {
        const bakeResult = await new Promise<
          | { ok: true; bytes: Uint8Array }
          | { ok: false; reason: string; message?: string }
        >((resolve) => {
          window.dispatchEvent(
            new CustomEvent("editor:share-bake", {
              detail: { onComplete: resolve },
            }),
          );
        });

        if (bakeResult.ok) {
          fileToShare = new File([bakeResult.bytes as BlobPart], file.name, {
            type: "application/pdf",
          });
        } else {
          logger.warn("[share] overlay bake failed; sharing unbaked bytes", {
            reason: bakeResult.reason,
            message: bakeResult.message,
          });
          toast.info({
            title: "Sharing without overlay bake",
            description:
              "Couldn't include the watermark / background image right now; text and shape edits will still be in the shared PDF.",
          });
        }
      } catch (err) {
        logger.captureError(err, "share.bake_dispatch");
      }
    }

    if (isW9Route) {
      const formState = useFormEditorStore.getState();
      const { sessionId, values, signatureKey } = formState;

      if (!sessionId) {
        setSubmitting(false);
        toast.error({
          title: "W-9 session not ready",
          description:
            "Give it a moment while we start your W-9 session, then try Share again.",
        });

        return;
      }

      try {
        const { downloadUrl } = await formsService.finalizeFormSession({
          sessionId,
          values: normalizeW9ValuesForFinalize(values),
          signatureKey,
        });
        const res = await fetch(downloadUrl, { cache: "no-store" });

        if (!res.ok) {
          throw new Error(`Failed to fetch stamped W-9 (HTTP ${res.status})`);
        }
        const stampedBytes = await res.arrayBuffer();

        fileToShare = new File([stampedBytes], "w-9.pdf", {
          type: "application/pdf",
        });
        shareName = "w-9.pdf";
      } catch (err) {
        logger.captureError(err, "w9.share.finalize");
        setSubmitting(false);
        toast.error({
          title: "Couldn't prepare your W-9 for sharing",
          description:
            err instanceof Error
              ? err.message
              : "Please try again in a moment.",
        });

        return;
      }
    }

    const result = await createShare({
      file: fileToShare,
      expiresAt,
      password: withPassword ? password : undefined,
      name: shareName,
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error({
        title: "Couldn't create share link",
        description: reasonToMessage(result.reason),
      });

      return;
    }

    setGenerated({ url: result.data.url, expiresAt: result.data.expiresAt });
  };

  const onCopy = async (): Promise<void> => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      toast.error({
        title: "Couldn't copy",
        description: "Select the link and copy it manually.",
      });
    }
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) close();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[480px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Share PDF</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-5 px-6">
            {!generated && (
              <>
                <p className="text-xs text-default-500">
                  {file
                    ? `Anyone with the link can view ${file.name}.`
                    : "Open a PDF before creating a share link."}
                </p>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    Link expires after
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {EXPIRY_PRESETS.map((p) => {
                      const checked = expiry === p.id;

                      // `ring-inset` keeps the selection ring inside the
                      // button's border-box. Without it, the 2px outer
                      // ring on the leftmost pill bleeds past the flex
                      // container's left edge and gets clipped by
                      // `Modal.Body`'s overflow, so "24 hours" looks
                      // half-cut when selected.
                      return (
                        <button
                          key={p.id}
                          aria-pressed={checked}
                          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                            checked
                              ? "border-accent bg-accent/5 ring-2 ring-inset ring-accent"
                              : "border-default-200 hover:bg-default-50"
                          }`}
                          type="button"
                          onClick={() => setExpiry(p.id)}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Switch
                    isSelected={withPassword}
                    size="sm"
                    onChange={() => {
                      setWithPassword((v) => {
                        if (v) setPassword("");

                        return !v;
                      });
                    }}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      <Label className="text-sm">Require a password</Label>
                    </Switch.Content>
                  </Switch>
                  {withPassword && (
                    <div className="relative mb-3 w-full">
                      <TextField
                        className="w-full"
                        value={password}
                        onChange={(v) => setPassword(v)}
                      >
                        <Input
                          aria-label="Share password"
                          // `w-full` on both TextField + Input keeps the
                          // field inside the modal — HeroUI's default
                          // Input width grows past the modal edge on some
                          // Chrome widths. `pr-10` leaves room for the
                          // absolutely-positioned reveal toggle so the
                          // caret never sits under the eye icon.
                          className="w-full pr-10"
                          placeholder="Password (4–128 chars)"
                          type={revealPassword ? "text" : "password"}
                        />
                      </TextField>
                      <PasswordRevealToggle
                        revealed={revealPassword}
                        onToggle={() => setRevealPassword((v) => !v)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {generated && (
              <div className="space-y-3">
                <Label>Share link</Label>
                <div className="relative w-full">
                  <TextField className="w-full" value={generated.url}>
                    <Input
                      readOnly
                      aria-label="Generated share link"
                      // `w-full` matches the password field fix so the
                      // URL input can't overflow the modal on Chrome.
                      // `pr-10` keeps the URL text from sliding under
                      // the inline copy button on narrow modals.
                      className="w-full pr-10"
                      onFocus={(e: React.FocusEvent<HTMLInputElement>) =>
                        e.target.select()
                      }
                    />
                  </TextField>
                  <button
                    aria-label={
                      copyState === "copied" ? "Link copied" : "Copy share link"
                    }
                    aria-live="polite"
                    className="absolute inset-y-0 right-0 z-10 flex items-center justify-center px-3 text-default-400 transition-colors hover:text-default-700 focus-visible:text-default-700 focus-visible:outline-none"
                    tabIndex={0}
                    type="button"
                    onClick={() => void onCopy()}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <HugeiconsIcon
                      icon={copyState === "copied" ? Tick02Icon : Copy01Icon}
                      size={16}
                    />
                  </button>
                </div>
                <p className="text-xs text-default-500">
                  Expires {new Date(generated.expiresAt).toLocaleString()}.
                </p>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            {!generated && (
              <>
                <Button
                  isDisabled={submitting}
                  slot="close"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  isDisabled={
                    submitting || !file || (withPassword && !password)
                  }
                  onPress={() => void onGenerate()}
                >
                  {submitting ? "Generating…" : "Generate link"}
                </Button>
              </>
            )}
            {generated && (
              <>
                <Button slot="close" variant="secondary">
                  Done
                </Button>
                <Button onPress={() => void onCopy()}>
                  {copyState === "copied" ? "Copied!" : "Copy link"}
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "unauthorized":
      return "Please sign in to create share links.";
    case "file-missing":
      return "The PDF couldn't be read. Try re-opening it.";
    case "file-too-large":
      return "PDF exceeds the 25 MB share limit.";
    case "not-a-pdf":
      return "The current file isn't a valid PDF.";
    case "expiry-out-of-range":
      return "Expiry must be between 1 hour and 30 days.";
    case "invalid-password":
      return "Password must be 4–128 characters.";
    default:
      return "Something went wrong. Please try again.";
  }
}
