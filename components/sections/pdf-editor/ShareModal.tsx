"use client";

import { Button, Input, Label, Modal, Switch, TextField } from "@heroui/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { createShare } from "@/lib/client/api/shares";
import { toast } from "@/lib/shared/utils/toast";

type ShareModalProps = {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
};

type ExpiryPreset = "1d" | "7d" | "30d";

const EXPIRY_PRESETS: { id: ExpiryPreset; label: string; ms: number }[] = [
  { id: "1d", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

export function ShareModal({
  file,
  isOpen,
  onClose,
}: ShareModalProps): React.ReactElement {
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
    const result = await createShare({
      file,
      expiresAt,
      password: withPassword ? password : undefined,
      name: file.name,
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

          <Modal.Body className="space-y-5">
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

                      return (
                        <button
                          key={p.id}
                          aria-pressed={checked}
                          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                            checked
                              ? "border-accent bg-accent/5 ring-2 ring-accent"
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
                    <div className="relative">
                      <TextField
                        value={password}
                        onChange={(v) => setPassword(v)}
                      >
                        <Input
                          aria-label="Share password"
                          // Right padding leaves room for the absolutely
                          // positioned reveal toggle so the caret never
                          // sits under the eye icon.
                          className="pr-10"
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
                <div className="relative">
                  <TextField value={generated.url}>
                    <Input
                      readOnly
                      aria-label="Generated share link"
                      // Right padding keeps the URL text from sliding under
                      // the inline copy button on narrow modals.
                      className="pr-10"
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
