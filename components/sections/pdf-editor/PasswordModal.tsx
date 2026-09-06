"use client";

import type { EncryptKeyLength } from "@/lib/shared/types/pdf-tools.types";

import { useAuth } from "@clerk/nextjs";
import { Button, Label, Modal } from "@heroui/react";
import { useState } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { verifyPdfPassword } from "@/lib/client/pdf-editor/verify-pdf-password";
import {
  useDecryptFileMutation,
  useEncryptFileMutation,
} from "@/lib/client/query/mutations";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

type Mode = "protect" | "unprotect";

export function PasswordModal() {
  const isOpen = usePdfEditorStore((s) => s.isPasswordModalOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsPasswordModalOpen);
  const variant = usePdfEditorStore((s) => s.passwordModalVariant);
  const file = usePdfEditorStore((s) => s.file);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setPdfSourceUrl = usePdfEditorStore((s) => s.setPdfSourceUrl);
  const documentPassword = usePdfEditorStore((s) => s.documentPassword);
  const documentPasswordFileKey = usePdfEditorStore(
    (s) => s.documentPasswordFileKey,
  );
  const setDocumentPassword = usePdfEditorStore((s) => s.setDocumentPassword);
  const { isSignedIn } = useAuth();

  const isUnlockOnly = variant === "unlock-only";
  // `mode` is only meaningful when the tab bar is visible (variant=both).
  // In unlock-only we derive it from variant so a prior "protect" tab
  // selection from an earlier both-variant open doesn't leak in. The
  // tab-toggle buttons that call `setMode` are hidden in unlock-only,
  // so this stays consistent without a setState-in-effect.
  const [mode, setMode] = useState<Mode>("protect");
  const effectiveMode: Mode = isUnlockOnly ? "unprotect" : mode;
  const [userPassword, setUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [unprotectPassword, setUnprotectPassword] = useState("");
  const [keyLength, setKeyLength] = useState<EncryptKeyLength>("256");
  const [mismatchError, setMismatchError] = useState(false);
  const [unprotectError, setUnprotectError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  // Reveal toggles — one per password field. Each reveals only its own
  // input; protect mode keeps the Confirm field independently masked so the
  // user can verify the strong password without exposing both fields at once.
  const [revealUserPassword, setRevealUserPassword] = useState(false);
  const [revealConfirmPassword, setRevealConfirmPassword] = useState(false);
  const [revealUnprotectPassword, setRevealUnprotectPassword] = useState(false);

  const encrypt = useEncryptFileMutation();
  const decrypt = useDecryptFileMutation();
  const isBusy = encrypt.isPending || decrypt.isPending || isVerifyingPassword;

  const handleClose = () => {
    if (isBusy) return;
    setUserPassword("");
    setConfirmPassword("");
    setUnprotectPassword("");
    setMismatchError(false);
    setUnprotectError(null);
    setIsOpen(false);
  };

  // Mirrors the Compress / Export flow: save the working PDF to IDB, pop
  // the sign-in confirm modal, and hand Clerk a `redirect_url` back to the
  // composer with the tool slug set so the hydrator re-opens this modal
  // after sign-in and the user picks up where they left off.
  const guardSignedIn = async (m: Mode): Promise<boolean> => {
    if (isSignedIn || !file) return true;
    // Snapshot file + fabric edits + extractedPages so the hydrator
    // restores overlays too. File-only save reintroduces the
    // "first-time login drops my edits" bug.
    await snapshotPendingEditorFile().catch((err) =>
      logger.warn("pending editor file save failed", err),
    );

    const slug = m === "protect" ? "password" : "unlock";
    const returnTo = `${ROUTES.TOOLS.PDF_EDITOR}?tool=${slug}`;

    // Email-first modal so a NEW-email user gets auto-signed-up
    // (backend creates the Clerk account + emails a password) instead
    // of hitting "We couldn't find an account with that email" on the
    // login form (QA 2026-09-06). Downstream chain is identical to
    // useExportEditor's Download flow — probe → LoginToDownloadModal
    // (existing) or runAutoSignup → ticket → finalize →
    // window.location.assign(returnTo). The hydrator's Step 4
    // re-opens THIS PasswordModal via `?tool=<slug>` after the
    // full-page nav lands.
    dispatchEmailFirstModal({
      redirectUrl: returnTo,
      title: m === "protect" ? "Secure your PDF" : "Unlock your PDF",
      subtitle:
        m === "protect"
          ? "Create an account to add password protection."
          : "Create an account to remove the password.",
      submitLabel: m === "protect" ? "Protect PDF" : "Unlock PDF",
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
      // Remember the password we just set on this document so the Remove
      // flow (which runs on the still-unencrypted in-memory file) can
      // validate against it. The store scopes this to the current file
      // identity — opening a different file drops it automatically.
      setDocumentPassword(userPassword);
      handleClose();
    } catch {
      // mutation already toasts the error
    }
  };

  const handleUnprotect = async () => {
    if (!file) return;
    setUnprotectError(null);

    // Password validation strategy:
    //
    //   1. If the user just protected THIS file in this session, we've
    //      stashed the password in the store (see handleProtect). The
    //      in-memory file is still the unencrypted original — pdf.js
    //      would report "not-encrypted" and refuse to validate. So
    //      compare against the remembered password directly. This is
    //      the flow the QA bug was about: protect a PDF, come back,
    //      type the wrong password, expect "Incorrect password" (not
    //      "This PDF isn't password-protected").
    //
    //   2. Otherwise the file may have arrived already encrypted (uploaded
    //      / restored / handed in from another tool). Fall back to
    //      pdf.js verification, which detects real encryption and can
    //      distinguish "wrong password" from "not encrypted".
    //
    // Either way, nothing leaves the browser until the password is
    // proven correct — a wrong guess never reaches the backend.
    const currentFileKey = `${file.name}:${file.size}:${file.lastModified}`;
    const hasRememberedPassword =
      documentPassword != null && documentPasswordFileKey === currentFileKey;

    setIsVerifyingPassword(true);
    try {
      if (hasRememberedPassword) {
        if (unprotectPassword !== documentPassword) {
          setUnprotectError(
            "Incorrect password. Enter the password currently set on this PDF.",
          );

          return;
        }
      } else {
        const verdict = await verifyPdfPassword(file, unprotectPassword);

        if (verdict.status === "not-encrypted") {
          // In the dedicated Unlock PDF flow (e.g. `?tool=unlock` from a
          // dashboard tile), the modal is opened for us — the file might
          // already be unencrypted. Instead of blocking the user behind
          // an error they can't submit past, close the modal and let
          // them keep editing. QA 2026-08-26: users hit the unlock
          // screen with an already-unlocked PDF and had no way through.
          if (isUnlockOnly) {
            toast.info({
              title: "PDF is already unlocked",
              description: "You can start editing straight away.",
            });
            handleClose();

            return;
          }
          setUnprotectError(
            "This PDF is not password-protected — there's nothing to remove.",
          );

          return;
        }
        if (verdict.status === "incorrect-password") {
          setUnprotectError(
            "Incorrect password. Enter the password currently set on this PDF.",
          );

          return;
        }
        if (verdict.status === "load-failed") {
          setUnprotectError(
            "Couldn't read this PDF to verify the password. It may be corrupt.",
          );

          return;
        }
      }
    } catch (err) {
      logger.warn("password verification threw", err);
      setUnprotectError("Couldn't verify the password. Please try again.");

      return;
    } finally {
      setIsVerifyingPassword(false);
    }

    if (!(await guardSignedIn("unprotect"))) return;
    try {
      const result = await decrypt.mutateAsync({
        file,
        password: unprotectPassword,
      });

      // Load the unlocked bytes back into the editor so the user can
      // keep working (edit / sign / re-export). Preserves the original
      // filename so re-saves and downloads read naturally. The store's
      // setFile chain triggers `usePdfLoader` → pdf.js re-parses the
      // decrypted bytes → editor re-renders without the password
      // prompt. Download remains one click away via the editor's own
      // Download / Export button (secondary action per product spec).
      const unlockedFile = new File([result.blob], result.fileName, {
        type: "application/pdf",
      });

      // Cloud-loaded docs (`?id=<doc>`) set `pdfSourceUrl` first and
      // `usePdfLoader` keys off it — a bare `setFile` here would leave
      // pdf.js pointed at the ORIGINAL encrypted URL and the editor
      // would stay on the "This PDF is password-protected" error screen
      // even though the unlock succeeded (QA 2026-08-26: green toast
      // fires but the user can't proceed). Clearing the URL forces the
      // loader to re-run against the new File identity — mirrors what
      // `applyPostSaveReset` does after a save.
      setPdfSourceUrl(null);
      setFile(unlockedFile);
      // Protection is gone — forget the remembered password so a
      // second Remove attempt correctly falls back to pdf.js checks.
      setDocumentPassword(null);
      toast.success({
        title: "PDF unlocked",
        description:
          "You can keep editing here, or use Download to save the unlocked copy.",
      });
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
            <Modal.Heading>
              {isUnlockOnly ? "Unlock PDF" : "Password protect"}
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-5">
            <p className="text-xs text-default-500">
              {file
                ? `Working file — ${file.name}`
                : isUnlockOnly
                  ? "Open a PDF before removing its password."
                  : "Open a PDF before protecting/unprotecting."}
            </p>

            {isUnlockOnly ? null : (
              <div className="flex gap-2">
                <Button
                  aria-pressed={mode === "protect"}
                  size="sm"
                  variant={mode === "protect" ? "secondary" : "ghost"}
                  onPress={() => {
                    setMode("protect");
                    setUnprotectError(null);
                  }}
                >
                  Add password
                </Button>
                <Button
                  aria-pressed={mode === "unprotect"}
                  size="sm"
                  variant={mode === "unprotect" ? "secondary" : "ghost"}
                  onPress={() => {
                    setMode("unprotect");
                    setMismatchError(false);
                  }}
                >
                  Remove password
                </Button>
              </div>
            )}

            {effectiveMode === "protect" ? (
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
                    className={`w-full rounded-md border px-3 py-2 pr-10 text-sm ${
                      unprotectError ? "border-red-500" : "border-default-200"
                    }`}
                    type={revealUnprotectPassword ? "text" : "password"}
                    value={unprotectPassword}
                    onChange={(e) => {
                      setUnprotectPassword(e.target.value);
                      setUnprotectError(null);
                    }}
                  />
                  <PasswordRevealToggle
                    revealed={revealUnprotectPassword}
                    onToggle={() => setRevealUnprotectPassword((v) => !v)}
                  />
                </div>
                {unprotectError && (
                  <p className="mt-1 text-xs text-red-500">{unprotectError}</p>
                )}
                <p className="mt-1 text-[11px] text-default-400">
                  The password you set on the PDF is required to remove
                  protection.
                </p>
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
                (effectiveMode === "protect"
                  ? userPassword.length === 0 || confirmPassword.length === 0
                  : unprotectPassword.length === 0)
              }
              onPress={() =>
                effectiveMode === "protect"
                  ? void handleProtect()
                  : void handleUnprotect()
              }
            >
              {isVerifyingPassword
                ? "Verifying password…"
                : isBusy
                  ? "Working…"
                  : effectiveMode === "protect"
                    ? "Protect & download"
                    : isUnlockOnly
                      ? "Unlock PDF"
                      : "Unlock & keep editing"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
