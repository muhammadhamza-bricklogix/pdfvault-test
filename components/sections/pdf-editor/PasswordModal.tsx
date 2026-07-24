"use client";

import type { EncryptKeyLength } from "@/lib/shared/types/pdf-tools.types";

import { useAuth } from "@clerk/nextjs";
import { Button, Label, Modal } from "@heroui/react";
import { useState } from "react";

import { dispatchSignInPrompt } from "@/components/shared/sign-in-prompt-modal";
import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import {
  useDecryptFileMutation,
  useEncryptFileMutation,
} from "@/lib/client/query/mutations";
import { usePdfEditorStore } from "@/lib/client/stores";
import { savePendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";

type Mode = "protect" | "unprotect";

export function PasswordModal() {
  const isOpen = usePdfEditorStore((s) => s.isPasswordModalOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsPasswordModalOpen);
  const file = usePdfEditorStore((s) => s.file);
  const { isSignedIn } = useAuth();

  const [mode, setMode] = useState<Mode>("protect");
  const [userPassword, setUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [unprotectPassword, setUnprotectPassword] = useState("");
  const [keyLength, setKeyLength] = useState<EncryptKeyLength>("256");
  const [mismatchError, setMismatchError] = useState(false);
  // Reveal toggles — one per password field. Each reveals only its own
  // input; protect mode keeps the Confirm field independently masked so the
  // user can verify the strong password without exposing both fields at once.
  const [revealUserPassword, setRevealUserPassword] = useState(false);
  const [revealConfirmPassword, setRevealConfirmPassword] = useState(false);
  const [revealUnprotectPassword, setRevealUnprotectPassword] = useState(false);

  const encrypt = useEncryptFileMutation();
  const decrypt = useDecryptFileMutation();
  const isBusy = encrypt.isPending || decrypt.isPending;

  const handleClose = () => {
    if (isBusy) return;
    setUserPassword("");
    setConfirmPassword("");
    setUnprotectPassword("");
    setMismatchError(false);
    setIsOpen(false);
  };

  // Mirrors the Compress / Export flow: save the working PDF to IDB, pop
  // the sign-in confirm modal, and hand Clerk a `redirect_url` back to the
  // composer with the tool slug set — hydrator re-opens this modal after
  // sign-in so the user picks up where they left off.
  const guardSignedIn = async (mode: Mode): Promise<boolean> => {
    if (isSignedIn || !file) return true;
    try {
      await savePendingEditorFile(file);
    } catch (err) {
      logger.warn("pending editor file save failed", err);
    }

    const slug = mode === "protect" ? "password" : "unlock";
    const returnTo = `${ROUTES.TOOLS.PDF_EDITOR}?tool=${slug}`;

    dispatchSignInPrompt({
      title:
        mode === "protect"
          ? "Sign in to password protect"
          : "Sign in to unlock",
      description:
        "This is a paid feature. Sign in and we'll bring you back here to finish.",
      confirmLabel: "Sign in & continue",
      redirectUrl: returnTo,
    });
    setIsOpen(false);

    return false;
  };

  const handleProtect = async () => {
    if (!file) return;
    if (userPassword !== confirmPassword) {
      setMismatchError(true);

      return;
    }
    setMismatchError(false);
    if (!(await guardSignedIn("protect"))) return;
    try {
      const result = await encrypt.mutateAsync({
        file,
        userPassword,
        keyLength,
      });

      triggerBlobDownload(result.blob, result.fileName);
      handleClose();
    } catch {
      // mutation already toasts the error
    }
  };

  const handleUnprotect = async () => {
    if (!file) return;
    if (!(await guardSignedIn("unprotect"))) return;
    try {
      const result = await decrypt.mutateAsync({
        file,
        password: unprotectPassword,
      });

      triggerBlobDownload(result.blob, result.fileName);
      handleClose();
    } catch {
      // mutation already toasts the error
    }
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[480px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Password protect</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-5">
            <p className="text-xs text-default-500">
              {file
                ? `Working file — ${file.name}`
                : "Open a PDF before protecting/unprotecting."}
            </p>

            <div className="flex gap-2">
              <Button
                aria-pressed={mode === "protect"}
                size="sm"
                variant={mode === "protect" ? "secondary" : "ghost"}
                onPress={() => setMode("protect")}
              >
                Add password
              </Button>
              <Button
                aria-pressed={mode === "unprotect"}
                size="sm"
                variant={mode === "unprotect" ? "secondary" : "ghost"}
                onPress={() => setMode("unprotect")}
              >
                Remove password
              </Button>
            </div>

            {mode === "protect" ? (
              <div className="space-y-3">
                <div>
                  <Label className="mb-1 block text-xs text-default-500">
                    Password
                  </Label>
                  <div className="relative">
                    <input
                      autoComplete="new-password"
                      className="w-full rounded-md border border-default-200 px-3 py-2 pr-10 text-sm"
                      type={revealUserPassword ? "text" : "password"}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                    />
                    <PasswordRevealToggle
                      revealed={revealUserPassword}
                      onToggle={() => setRevealUserPassword((v) => !v)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-default-500">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <input
                      autoComplete="new-password"
                      className={`w-full rounded-md border px-3 py-2 pr-10 text-sm ${
                        mismatchError ? "border-red-500" : "border-default-200"
                      }`}
                      type={revealConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setMismatchError(false);
                      }}
                    />
                    <PasswordRevealToggle
                      revealed={revealConfirmPassword}
                      onToggle={() => setRevealConfirmPassword((v) => !v)}
                    />
                  </div>
                  {mismatchError && (
                    <p className="mt-1 text-xs text-red-500">
                      Passwords don&apos;t match.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-default-500">
                    Encryption
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      aria-pressed={keyLength === "256"}
                      size="sm"
                      variant={keyLength === "256" ? "secondary" : "ghost"}
                      onPress={() => setKeyLength("256")}
                    >
                      AES-256 (recommended)
                    </Button>
                    <Button
                      aria-pressed={keyLength === "128"}
                      size="sm"
                      variant={keyLength === "128" ? "secondary" : "ghost"}
                      onPress={() => setKeyLength("128")}
                    >
                      RC4-128 (legacy)
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-default-400">
                    AES-256 is the modern standard. Pick RC4-128 only if the
                    file must open in older PDF viewers.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  Current password
                </Label>
                <div className="relative">
                  <input
                    autoComplete="current-password"
                    className="w-full rounded-md border border-default-200 px-3 py-2 pr-10 text-sm"
                    type={revealUnprotectPassword ? "text" : "password"}
                    value={unprotectPassword}
                    onChange={(e) => setUnprotectPassword(e.target.value)}
                  />
                  <PasswordRevealToggle
                    revealed={revealUnprotectPassword}
                    onToggle={() => setRevealUnprotectPassword((v) => !v)}
                  />
                </div>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button isDisabled={isBusy} slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={
                !file ||
                isBusy ||
                (mode === "protect"
                  ? userPassword.length === 0 || confirmPassword.length === 0
                  : unprotectPassword.length === 0)
              }
              onPress={() =>
                mode === "protect"
                  ? void handleProtect()
                  : void handleUnprotect()
              }
            >
              {isBusy
                ? "Working…"
                : mode === "protect"
                  ? "Protect & download"
                  : "Unprotect & download"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
