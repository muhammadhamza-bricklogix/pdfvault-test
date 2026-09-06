"use client";

import type { SessionVerificationLevel } from "@clerk/shared/types";

import {
  useClerk,
  useReverification,
  useSession,
  useUser,
} from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Alert01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
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

type VerificationState = {
  complete: () => void;
  cancel: () => void;
  level: SessionVerificationLevel | undefined;
};

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
  // Custom reverification modal state — set by the `onNeedsReverification`
  // handler below when Clerk demands a step-up. Kept in our own state so
  // we render our HeroUI modal instead of Clerk's branded one.
  const [verificationState, setVerificationState] =
    useState<VerificationState | null>(null);

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
  // handles that flow; the `onNeedsReverification` option lets us
  // render OUR modal instead of Clerk's default one (which leaked the
  // "Secured by Clerk" branding + "Development mode" chip — QA
  // 2026-09-05). Once our modal completes, the wrapper reruns the
  // wrapped fetcher automatically.
  const deleteAccount = useReverification(
    useCallback(async () => {
      if (!user) throw new Error("No signed-in user.");
      await user.delete();
    }, [user]),
    {
      onNeedsReverification: ({ complete, cancel, level }) => {
        setVerificationState({ complete, cancel, level });
      },
    },
  );

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
  // confirmation modal. Runs the Clerk reverification + delete + sign
  // out + redirect. Errors surface back on the email modal (re-opened)
  // so the user has full context of what failed and can retry.
  const handleFinalDelete = async () => {
    if (!user) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteAccount();
      await signOut();
      router.push(ROUTES.PUBLIC.HOME);
    } catch (err) {
      // User closed the reverification modal without completing it —
      // silent bail, reopen the email dialog so they can retry.
      if (isReverificationCancelledError(err)) {
        setIsDeleting(false);
        setIsFinalConfirmOpen(false);
        setIsOpen(true);

        return;
      }
      setError(humaniseDeleteError(err));
      setIsDeleting(false);
      setIsFinalConfirmOpen(false);
      setIsOpen(true);
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
                If you&apos;ve requested a copy of your data, please wait until
                it&apos;s ready before deleting your account — otherwise, your
                access request won&apos;t be completed.
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

      {verificationState ? (
        <ReverifyPasswordModal
          onCancel={() => {
            verificationState.cancel();
            setVerificationState(null);
          }}
          onComplete={() => {
            verificationState.complete();
            setVerificationState(null);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * In-house step-up modal used by the delete-account flow. Replaces
 * Clerk's default reverification widget so we don't leak "Secured by
 * Clerk" / "Development mode" chrome to end users. All of our
 * signed-in users hold a Clerk password (manual signup requires one,
 * `runAutoSignup` provisions a random password + emails it) so a
 * password-only step-up is enough — if a passwordless account ever
 * shows up we surface the "Use another method" link to fall back to
 * Clerk's own flow.
 */
function ReverifyPasswordModal({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: () => void;
}) {
  const { session } = useSession();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session || submitting) return;
    if (!password.trim()) {
      setError("Enter your password to continue.");

      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // `first_factor` covers the password reverification path. Clerk
      // returns a fresh SessionVerificationResource — we don't need to
      // read it because `attemptFirstFactorVerification` completes the
      // step-up in-place.
      await session.startVerification({ level: "first_factor" });
      await session.attemptFirstFactorVerification({
        password,
        strategy: "password",
      });
      onComplete();
    } catch (err) {
      const first = (err as { errors?: { code?: string; message?: string }[] })
        ?.errors?.[0];
      const code = first?.code;

      if (
        code === "form_password_incorrect" ||
        code === "form_password_not_matched"
      ) {
        setError("That password isn't right. Try again.");
      } else if (
        code === "clerk_rate_limit_exceeded" ||
        code === "too_many_attempts"
      ) {
        setError("Too many attempts. Wait a minute and try again.");
      } else {
        setError(
          first?.message ??
            "Verification failed. Please try again in a moment.",
        );
      }
      setSubmitting(false);
    }
  };

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Verification required</Modal.Heading>
          </Modal.Header>
          <form onSubmit={handleSubmit}>
            <Modal.Body>
              <p className="text-sm text-default-500">
                Enter your current password to confirm this is you.
              </p>
              <label
                className="mt-4 block text-[13px] font-medium text-[var(--color-foreground)]"
                htmlFor="reverify-password"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  autoFocus
                  aria-invalid={error ? true : undefined}
                  autoComplete="current-password"
                  className="w-full rounded-md border border-default-200 bg-[var(--color-background)] px-3 py-2 pr-10 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-danger"
                  id="reverify-password"
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                />
                <PasswordRevealToggle
                  revealed={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              </div>
              {error ? (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <p className="mt-3 text-[12px] text-default-500">
                <Link
                  className="text-[#f12c23] underline underline-offset-2 hover:opacity-80"
                  href={ROUTES.AUTH.FORGOT_PASSWORD}
                >
                  Forgot your password?
                </Link>
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={submitting}
                variant="secondary"
                onPress={onCancel}
              >
                Cancel
              </Button>
              <Button
                isDisabled={submitting || !password.trim()}
                type="submit"
                variant="danger"
              >
                {submitting ? "Verifying…" : "Continue"}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
