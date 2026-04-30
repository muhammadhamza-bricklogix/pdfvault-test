"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Alert01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

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
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          Danger zone
        </h2>
        <p className="text-sm text-default-500">
          Irreversible actions. Proceed with care.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border border-danger/40 bg-[var(--color-background)] p-5">
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            className="mt-0.5 shrink-0 text-danger"
            icon={Alert01Icon}
            size={20}
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              Delete account
            </p>
            <p className="text-sm text-default-500">
              Permanently delete your account and all associated documents. This
              action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="danger" onPress={() => setIsOpen(true)}>
            Delete account
          </Button>
        </div>
      </div>

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
              {error && (
                <p className="mt-2 text-xs text-danger">
                  {error}
                </p>
              )}
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
    </div>
  );
}
