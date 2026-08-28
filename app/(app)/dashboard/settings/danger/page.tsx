"use client";

import { useClerk, useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Alert01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  PvFormRow,
  PvSectionHeading,
} from "@/components/sections/dashboard/settings/pv-settings-primitives";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";
import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * True when the subscription is in a state that still bills the user
 * on renewal — the user must cancel first, otherwise Solidgate would
 * keep charging a deleted-in-Clerk account (backend has no way to
 * reconcile that once the Clerk user id is gone). `cancelledButActive`
 * counts as "already cancelled" — auto-renew is off, access just runs
 * to the end of the paid period.
 */
type SubscriptionSnapshotLike = {
  status?: string;
  cancelledButActive?: boolean;
};

function isBillingActive(sub: SubscriptionSnapshotLike | null | undefined) {
  if (!sub) return false;
  if (sub.cancelledButActive) return false;

  return sub.status === "ACTIVE" || sub.status === "TRIALING";
}

/**
 * Turn a Clerk delete-account error into an actionable message. Clerk's
 * default "Self deletion is not enabled" wording strands the user with
 * no next step; surface a concrete recommendation for the common cases.
 */
function humaniseDeleteError(err: unknown): string {
  const anyErr = err as {
    errors?: {
      code?: string;
      message?: string;
      longMessage?: string;
    }[];
    message?: string;
  };
  const first = anyErr?.errors?.[0];
  const code = first?.code;
  const raw = first?.longMessage ?? first?.message ?? anyErr?.message ?? "";

  if (code === "user_delete_self_not_enabled") {
    return "Account deletion is disabled for this workspace. Email support@pdfvault.ai and we'll remove your account for you.";
  }
  if (code === "session_reverification_required") {
    // Should never surface — `useReverification` wraps the delete call
    // and opens Clerk's own verification modal automatically. Kept as
    // a fallback in case the wrapper is bypassed.
    return "For your security we need to verify it's you. A verification prompt should appear — if it didn't, try again.";
  }
  if (code === "form_password_incorrect") {
    return "Password check failed. Sign out and back in, then try again.";
  }
  if (code === "clerk_rate_limit_exceeded" || code === "too_many_attempts") {
    return "Too many attempts. Wait a minute and try again.";
  }

  return raw || "Failed to delete account. Please try again in a moment.";
}

export default function DangerZonePage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { data: subscription } = useSubscriptionQuery();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const canConfirm =
    confirmation.trim().toLowerCase() === email.toLowerCase() && email !== "";
  // QA 2026-08-28: users with an active/trialing subscription hit
  // "does not let me delete the account" — even after they thought
  // they cancelled. Root cause: auto-renew was still on. Block the
  // delete action until the subscription is properly cancelled (or in
  // the `cancelledButActive` grace period). Show a direct link to
  // Billing so the fix is one click away.
  const billingActive = isBillingActive(subscription);

  // QA 2026-08-28: Clerk now enforces "session reverification" for
  // sensitive actions (delete account, remove MFA, etc.) — first hit
  // returns `session_reverification_required` and Clerk expects the
  // client to prompt the user to re-authenticate (password / MFA),
  // then retry. Wrapping `user.delete()` with `useReverification`
  // gives us that flow for free: on the reverification error it opens
  // Clerk's own verification modal and, once the user completes it,
  // reruns the wrapped fetcher. Without this wrap the delete just
  // errors out with the raw 403 the user pasted.
  const deleteAccount = useReverification(
    useCallback(async () => {
      if (!user) throw new Error("No signed-in user.");
      await user.delete();
    }, [user]),
  );

  const handleDelete = async () => {
    if (!user || !canConfirm) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteAccount();
      await signOut();
      router.push(ROUTES.PUBLIC.HOME);
    } catch (err) {
      // User closed the reverification modal without completing it —
      // silent bail, keep the confirm dialog open so they can retry.
      if (isReverificationCancelledError(err)) {
        setIsDeleting(false);

        return;
      }
      setError(humaniseDeleteError(err));
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
        {billingActive ? (
          <div className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50/70 px-4 py-3">
            <HugeiconsIcon
              className="mt-0.5 shrink-0 text-amber-600"
              icon={Alert01Icon}
              size={18}
            />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-amber-900">
                Cancel your subscription first
              </p>
              <p className="mt-1 text-[12px] text-amber-800/90">
                Your subscription is still active, so we can&apos;t delete your
                account yet — otherwise your card would keep being billed after
                the account is gone. Cancel first from the Billing tab, then
                come back here to finish removing your account.
              </p>
            </div>
            <Link
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-amber-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-amber-700"
              href={ROUTES.APP.SETTINGS_BILLING}
            >
              Go to Billing
            </Link>
          </div>
        ) : (
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
        )}
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
                className="mx-0.5 mt-3 mb-1 w-[calc(100%-4px)] rounded-md border border-default-200 bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-danger"
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
