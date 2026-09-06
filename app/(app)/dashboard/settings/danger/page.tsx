"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Alert01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
    // Clerk requires the session to be recently reverified before a
    // delete can proceed. The custom password step-up was removed
    // (QA 2026-09-06 — user asked for a friction-free flow); if this
    // ever fires the user must sign out and back in, or we need to
    // reintroduce the step-up.
    return "For your security we need you to sign in again before deleting. Sign out, sign back in, and retry the deletion.";
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
  // Second-stage confirmation modal shown AFTER the email-match step.
  // Surfaces the full data-loss + subscription-refund + logout copy so
  // the user has an explicit "Yes, delete my data" moment before the
  // irreversible Clerk call fires.
  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState(false);
  // Post-delete success confirmation. Shown after `user.delete()` resolves
  // and BEFORE `signOut()` fires — gives the user a clear "your account
  // has been permanently deleted" moment instead of a silent bounce to
  // the marketing home. Continue button (or the 6-second safety timer)
  // triggers the sign-out + redirect.
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
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

  // Step 1 — user typed their email; hand off to the "Are you sure?"
  // modal. No API call yet: the actual delete happens only after they
  // click "Yes, delete my data" on the next modal.
  const handleEmailConfirmed = () => {
    if (!user || !canConfirm) return;
    setError(null);
    setIsOpen(false);
    setIsFinalConfirmOpen(true);
  };

  // Step 2 — user clicked "Yes, delete my data" on the final
  // confirmation modal. Runs the Clerk delete directly (no password
  // reverification step-up — removed 2026-09-06 per user request to
  // reduce friction). Errors surface back on the email modal
  // (re-opened) so the user has full context of what failed and can
  // retry. If Clerk's instance settings still enforce reverification
  // server-side, the humanised error message directs the user to
  // sign out + back in.
  const handleFinalDelete = async () => {
    if (!user) return;

    setIsDeleting(true);
    setError(null);

    try {
      await user.delete();
      // Delete succeeded — surface a success confirmation before signing
      // out. `signOut()` fires when the user clicks Continue on the
      // success modal (or the safety timer inside that modal expires).
      setIsDeleting(false);
      setIsFinalConfirmOpen(false);
      setIsSuccessOpen(true);

      return;
    } catch (err) {
      setError(humaniseDeleteError(err));
      setIsDeleting(false);
      setIsFinalConfirmOpen(false);
      setIsOpen(true);
    }
  };

  // Success modal → sign out and land on the marketing home. Wrapped in
  // useCallback so the auto-timer effect below has a stable reference.
  const finishSignOut = useCallback(async () => {
    setIsSuccessOpen(false);
    await signOut();
    router.push(ROUTES.PUBLIC.HOME);
  }, [signOut, router]);

  // Safety net — if the user leaves the success modal open (walked away,
  // hit an ad, etc.) auto-finalize after 6s so the Clerk session doesn't
  // linger on a deleted user id.
  useEffect(() => {
    if (!isSuccessOpen) return;
    const t = window.setTimeout(() => {
      void finishSignOut();
    }, 6000);

    return () => window.clearTimeout(t);
  }, [isSuccessOpen, finishSignOut]);

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
                onPress={handleEmailConfirmed}
              >
                {isDeleting ? "Deleting…" : "Delete my account"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop
        isOpen={isFinalConfirmOpen}
        onOpenChange={(open) => {
          // Disallow dismiss while the delete is in flight so the user
          // can't accidentally close the modal mid-request and lose
          // track of state. Cancel button + the X handle explicit exits.
          if (!open && !isDeleting) setIsFinalConfirmOpen(false);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[460px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-danger">
                Delete your account and data?
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <p className="text-sm text-[var(--color-foreground)]">
                Please note that all files you have stored or edited in PDFVault
                will be permanently lost and cannot be recovered. Your
                subscription will be cancelled and refund won&apos;t be issued.
              </p>
              <p className="text-sm text-[var(--color-foreground)]">
                Once you confirm, you will be logged out immediately. We will
                start deleting your account and personal data right away. Your
                information will also be forwarded to our service providers for
                deletion — this process may take them a bit longer to complete.
              </p>
              <p className="text-sm font-medium text-[var(--color-foreground)]">
                Are you sure you want to continue?
              </p>
              {error ? <p className="text-xs text-danger">{error}</p> : null}
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={isDeleting}
                variant="secondary"
                onPress={() => setIsFinalConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                isDisabled={isDeleting}
                variant="danger"
                onPress={handleFinalDelete}
              >
                {isDeleting ? "Deleting…" : "Yes, delete my data"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop
        isOpen={isSuccessOpen}
        onOpenChange={(open) => {
          // Any dismiss action (X, backdrop click, esc) counts as the
          // user acknowledging — sign them out and redirect. Prevents the
          // "modal closed but I'm still on /dashboard/settings/danger
          // with an invalid session" limbo state.
          if (!open) void finishSignOut();
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.Body className="flex flex-col items-center gap-4 px-6 py-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-green-100">
                <HugeiconsIcon
                  className="text-green-600"
                  icon={Tick01Icon}
                  size={28}
                  strokeWidth={2.5}
                />
              </span>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
                  Account deleted
                </h2>
                <p className="text-sm text-default-500">
                  Your account and all associated data have been permanently
                  deleted. We&apos;re sorry to see you go.
                </p>
              </div>
              <Button
                className="mt-2 w-full"
                variant="primary"
                onPress={() => void finishSignOut()}
              >
                Continue
              </Button>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}
