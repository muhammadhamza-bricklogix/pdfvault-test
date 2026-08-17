"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Alert01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  PvFormRow,
  PvSectionHeading,
} from "@/components/sections/dashboard/settings/pv-settings-primitives";
import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Danger zone — permanently delete the Clerk user + downstream data.
 * Rendered inside the new PvFormRow rhythm so it matches the other tabs.
 * Confirmation still requires typing the account email.
 */
export default function DangerZonePage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const canConfirm =
    confirmation.trim().toLowerCase() === email.toLowerCase() && email !== "";

  const handleDelete = async () => {
    if (!user || !canConfirm) return;

    setIsDeleting(true);
    setError(null);

    try {
      await user.delete();
      await signOut();
      router.push(ROUTES.PUBLIC.HOME);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete account. Please try again.",
      );
      setIsDeleting(false);
    }
  };

  return (
    <section>
      <PvSectionHeading
        description="Irreversible actions. Proceed with care."
        title="Danger zone"
      />

      <PvFormRow
        last
        description="Permanently delete your account and all associated documents. This action cannot be undone."
        label="Delete account"
      >
        <div className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50/60 px-4 py-3">
          <HugeiconsIcon
            className="mt-0.5 shrink-0 text-red-500"
            icon={Alert01Icon}
            size={18}
          />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-red-800">
              This will remove all of your PDFs and cannot be recovered.
            </p>
            <p className="mt-1 text-[12px] text-red-700/80">
              You&apos;ll be asked to confirm your email before the account is
              deleted.
            </p>
          </div>
          <button
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-red-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
            type="button"
            onClick={() => setIsOpen(true)}
          >
            Delete account
          </button>
        </div>
      </PvFormRow>

      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) setIsOpen(false);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[440px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Delete account</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-default-500">
                This will permanently delete your account, your documents, and
                all associated data. This cannot be undone.
              </p>
              <p className="mt-3 text-sm text-[var(--color-foreground)]">
                Type <span className="font-mono font-semibold">{email}</span> to
                confirm.
              </p>
              <input
                autoComplete="off"
                className="mt-2 w-full rounded-md border border-default-200 bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-danger"
                placeholder={email}
                type="email"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={isDeleting} slot="close" variant="secondary">
                Cancel
              </Button>
              <Button
                isDisabled={!canConfirm || isDeleting}
                variant="danger"
                onPress={handleDelete}
              >
                {isDeleting ? "Deleting…" : "Delete my account"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}
