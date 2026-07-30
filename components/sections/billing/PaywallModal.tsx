"use client";

import type { CheckoutIntent } from "@/lib/shared/types/billing.types";
import type { PaywallPreview } from "@/lib/client/hooks/billing/paywall-bus";

import { Accordion, Modal } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  useCreateCheckoutIntentMutation,
  useSyncSubscriptionMutation,
} from "@/lib/client/query/mutations/billing.mutation";
import { billingService } from "@/lib/shared/api/services/billing.service";
import { DISCLAIMER_VERSION } from "@/lib/shared/constants/billing";
import { billingKeys } from "@/lib/shared/constants/query-keys";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

// The payment SDK's iframe loader touches `window` at import time —
// dynamic import with `ssr: false` keeps the Next.js server bundle
// clean and avoids a 500 on the first request.
const PaymentForm = dynamic(
  () => import("@solidgate/react-sdk").then((m) => m.default),
  { ssr: false },
);

const CREAM = "#fdf3f0";
const CREAM_CARD = "#fef5f1";

type Step = "plan" | "pay" | "success";
type PlanId = "trial" | "monthly" | "annual";

interface PaywallModalProps {
  isOpen: boolean;
  /**
   * Optional preview of the file the user is trying to unlock — e.g.
   * the source Word doc on `/convert/word-to-pdf`. Rendered above the
   * plan picker as a blurred file card so the user sees "here is your
   * converted file" before paying. Falls back to the plain plan-picker
   * layout when undefined (axios interceptor path, generic downloads).
   */
  preview: PaywallPreview | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

/**
 * Three-step payment modal built from the "Payment Model" design:
 *
 *   Step 1 — "Choose your plan" — 2-column layout (value prop on the
 *            cream left, plan picker + Continue on the white right).
 *   Step 2 — "Pay securely" — 2-column layout (order summary cream
 *            left, payment iframe from the SDK on the white right).
 *   Step 3 — "You're all set!" — single centred column confirming
 *            the trial is active + shortcuts to keep working / view
 *            receipt.
 *
 * All checkout wiring (useCreateCheckoutIntentMutation, PaymentForm
 * iframe, syncSubscription, invalidateSubscription,
 * setEntitledSnapshot) is unchanged from the previous shell — only
 * the visual chrome around it moved.
 */
export function PaywallModal({
  isOpen,
  preview,
  onClose,
  onPaymentSuccess,
}: PaywallModalProps) {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("trial");
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When Solidgate reports a decline, we surface a "Try another card"
  // affordance instead of leaving the user staring at the read-only
  // "Payment declined" iframe. Bumping `retryKey` remounts the payment
  // iframe; fetching a fresh CheckoutIntent gives Solidgate a new
  // paymentIntent to attach the retry to (declined intents can be
  // marked terminal on their side and won't accept a second attempt).
  const [payFailed, setPayFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [retryLoading, setRetryLoading] = useState(false);
  const createIntent = useCreateCheckoutIntentMutation();
  const syncSubscription = useSyncSubscriptionMutation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep("plan");

    setSelectedPlan("trial");

    createIntent.mutate(
      { disclaimerVersion: DISCLAIMER_VERSION },
      {
        onSuccess: setIntent,
        onError: (err) => {
          logger.error("checkout intent failed", err);
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't start checkout. Please try again.",
          );
        },
      },
    );

    return () => {
      setIntent(null);
      setError(null);
      setPayFailed(false);
      setRetryKey(0);
    };
    // Intentionally depend only on `isOpen` — the mutation identity
    // would otherwise double-fire the intent request.
  }, [isOpen]);

  const handleIframeSuccess = async (message?: {
    order?: { subscription_id?: string };
  }) => {
    // Do NOT flip the entitlement snapshot optimistically on the iframe
    // callback. Solidgate's `onSuccess` can fire client-side before the
    // charge is confirmed server-side (declined-after-approval race,
    // 3DS re-auth failures, etc.), so we'd previously flash "Payment
    // received" and unlock premium tools for users whose card was never
    // debited. Instead: sync with the backend, force a fresh
    // subscription fetch, and only advance to the success step when the
    // backend confirms `entitled === true`.
    const subscriptionId = message?.order?.subscription_id;

    try {
      await syncSubscription.mutateAsync(
        subscriptionId ? { subscriptionId } : {},
      );

      // Force a fresh network fetch — `invalidateQueries` alone can
      // race the modal close and let the snapshot stay at its last
      // known value. `fetchQuery` guarantees we see the post-charge
      // entitlement before we decide which step to render.
      queryClient.removeQueries({ queryKey: billingKeys.subscription() });
      const fresh = await queryClient.fetchQuery({
        queryKey: billingKeys.subscription(),
        queryFn: billingService.getSubscription,
      });

      if (!fresh?.entitled) {
        logger.warn?.(
          "Solidgate onSuccess fired but backend still reports entitled=false",
          fresh,
        );
        setError(
          "Payment couldn't be confirmed. If your card was charged, please refresh in a minute or email payments@pdfvault.ai.",
        );

        return;
      }

      // useSubscriptionQuery's mirror effect will flip the snapshot on
      // the next tick — but the queued paywall action (onPaymentSuccess)
      // runs immediately after this returns, so pre-set the snapshot
      // here to avoid a one-tick lag where the retry still sees the
      // old value. `setEntitledSnapshot` is imported lazily to keep
      // the paths symmetrical — snapshot only ever flips true when the
      // backend has confirmed entitlement.
      const { setEntitledSnapshot } = await import(
        "@/lib/client/hooks/billing/entitlement-cache"
      );

      setEntitledSnapshot(true);

      toast.success({
        title: "Payment received",
        description: "Your access is unlocked.",
      });
      setStep("success");
    } catch (err) {
      logger.error("subscription sync after payment failed", err);
      setError(
        "We received your payment attempt but couldn't verify it. Please refresh in a minute or email payments@pdfvault.ai.",
      );
    }
  };

  const handleIframeFail = () => {
    setPayFailed(true);
    toast.error({
      title: "Payment declined",
      description: "Your card wasn't charged. Try another card to retry.",
    });
  };

  const handleRetry = () => {
    // Fresh CheckoutIntent for the retry — Solidgate marks the previous
    // paymentIntent terminal after a decline, so re-mounting the iframe
    // against the same intent just re-renders the "Payment declined"
    // state. Bump retryKey to force a full PaymentForm remount, then
    // load a new intent and drop the failed flag once it lands.
    setRetryLoading(true);
    setPayFailed(false);
    createIntent.mutate(
      { disclaimerVersion: DISCLAIMER_VERSION },
      {
        onSuccess: (fresh) => {
          setIntent(fresh);
          setRetryKey((k) => k + 1);
          setRetryLoading(false);
        },
        onError: (err) => {
          logger.error("checkout intent retry failed", err);
          setRetryLoading(false);
          setPayFailed(true);
          toast.error({
            title: "Couldn't start a new attempt",
            description:
              err instanceof Error
                ? err.message
                : "Please close this dialog and try again.",
          });
        },
      },
    );
  };

  // Fire only `onPaymentSuccess` here — usePaywall's own handler already
  // calls setIsOpen(false) + resolves the axios interceptor's promise
  // with "success" + runs the queued action. Calling `onClose()`
  // afterward races the "cancelled" resolver against the "success"
  // one and can bounce the caller's request with
  // PaywallCancelledError even though the payment went through.
  const finish = () => {
    onPaymentSuccess();
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className="items-start justify-center p-4 sm:items-center">
        <Modal.Dialog
          className={
            step === "success"
              ? "max-h-[calc(100dvh-32px)] w-[min(460px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] dark:bg-content1"
              : step === "plan"
                ? "max-h-[calc(100dvh-32px)] w-[min(1040px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:!max-w-[1040px] dark:bg-content1"
                : "max-h-[calc(100dvh-32px)] w-[min(920px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:!max-w-[920px] dark:bg-content1"
          }
        >
          <Modal.CloseTrigger />
          {error ? (
            <ErrorState error={error} />
          ) : !intent ? (
            <LoadingState />
          ) : step === "plan" ? (
            <PlanStep
              intent={intent}
              preview={preview}
              selectedPlan={selectedPlan}
              onContinue={() => setStep("pay")}
              onSelectPlan={setSelectedPlan}
            />
          ) : step === "pay" ? (
            <PayStep
              intent={intent}
              payFailed={payFailed}
              retryKey={retryKey}
              retryLoading={retryLoading}
              onFail={handleIframeFail}
              onRetry={handleRetry}
              onSuccess={handleIframeSuccess}
            />
          ) : (
            <SuccessStep intent={intent} onFinish={finish} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 1 — Choose your plan
// ─────────────────────────────────────────────────────────────
function PlanStep({
  intent,
  preview,
  selectedPlan,
  onSelectPlan,
  onContinue,
}: {
  intent: CheckoutIntent;
  preview: PaywallPreview | null;
  selectedPlan: PlanId;
  onSelectPlan: (id: PlanId) => void;
  onContinue: () => void;
}) {
  // UI-only pricing per product spec (2026-07-30). The backend
  // checkout-intent currently returns a single plan's amounts
  // (`intent.amountTodayMinor` / `amountRenewMinor`); until per-plan
  // intents are wired, the displayed prices below are the source of
  // truth for the picker. Trial and Monthly still fire the same intent
  // on Continue — see PayStep for the actual charge amounts.
  const trialPrice = "$0.99";
  const monthlyPrice = "$3.99";
  const annualPrice = "$24.99";
  // Fallback display for entry points where `intent` is loaded but no
  // preview exists — reuse the intent-derived amounts in the small
  // print so it never contradicts what will actually be charged.
  const today = formatMinor(intent.amountTodayMinor, intent.currency);
  const renew = formatMinor(intent.amountRenewMinor, intent.currency);

  const continueDisabled = selectedPlan === "annual";

  return (
    <div className="flex flex-col">
      {/* Header row — title (left) + Continue (right) */}
      <div className="flex flex-col gap-3 border-b border-[#ececec] p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
        <h2 className="pv-heading text-[20px] font-semibold text-[#1a1c21] sm:text-[24px]">
          {preview
            ? "Choose a plan to download your file"
            : "Choose a plan to unlock full access"}
        </h2>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <button
            className="inline-flex h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--pv-brand-red,#f12c23)] px-6 text-[14px] font-semibold text-white shadow-[0_10px_20px_-8px_rgba(241,44,35,0.55)] transition-colors hover:bg-[#d8241c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-red,#f12c23)] disabled:cursor-not-allowed disabled:bg-[#c7c7c7] disabled:shadow-none active:translate-y-px"
            disabled={continueDisabled}
            type="button"
            onClick={onContinue}
          >
            Continue
            {continueDisabled ? null : <span aria-hidden>→</span>}
          </button>
          {continueDisabled ? (
            <p className="text-[11px] text-[#6c6c6c]">
              Annual plan coming soon
            </p>
          ) : null}
        </div>
      </div>

      {/* Body — two columns */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left — preview column (or fallback content) */}
        <div
          className="flex flex-col gap-5 p-6 md:p-8"
          style={{ backgroundColor: CREAM }}
        >
          <BrandLogo />

          {preview ? (
            <>
              <span className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-[#0f9d58]">
                <span aria-hidden>✓</span>
                Your document is ready
              </span>
              <PreviewFileCard preview={preview} />
              <p className="text-[13px] leading-relaxed text-[#5c5c5c]">
                Subscribe below to download the converted file instantly and
                keep unlimited access to every PDFVault tool.
              </p>
            </>
          ) : (
            <>
              <span className="inline-flex h-7 w-fit items-center rounded-full bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--pv-brand-red,#f12c23)]">
                Limited-time offer
              </span>

              <h2 className="pv-heading text-[24px] font-semibold leading-tight text-[#1a1c21] sm:text-[28px]">
                Unlock the full PDFVault toolkit
              </h2>
              <p className="-mt-2 text-[14px] leading-relaxed text-[#5c5c5c]">
                Everything you need to convert, share, and edit — in one secure
                workspace.
              </p>

              <ul className="mt-1 flex flex-col gap-3 text-[14px] text-[#1a1c21]">
                <Feature>
                  Convert to and from Word, Excel, PowerPoint, JPG &amp; PNG
                </Feature>
                <Feature>Merge, split, compress &amp; organize pages</Feature>
                <Feature>
                  Unlimited edits, priority processing &amp; cloud sync
                </Feature>
              </ul>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <TrustPill label="SSL secure checkout" />
                <TrustPill label="Cancel anytime" />
                <TrustPill label="30-day support" />
              </div>
            </>
          )}
        </div>

        {/* Right — plan accordion column */}
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <PlanAccordion
            annualPrice={annualPrice}
            limitedPrice={trialPrice}
            selectedPlan={selectedPlan}
            standardPrice={monthlyPrice}
            onSelectPlan={onSelectPlan}
          />

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#6c6c6c]">
            <span>We accept</span>
            <CardBadge label="VISA" />
            <CardBadge label="Mastercard" />
            <CardBadge label="Amex" />
          </div>

          {selectedPlan === "trial" ? (
            <p className="text-[11px] leading-relaxed text-[#6c6c6c]">
              You&apos;ll be charged {today} today for 7-day limited access,
              then {renew} every 30 days unless you cancel before the trial
              ends.
            </p>
          ) : selectedPlan === "monthly" ? (
            <p className="text-[11px] leading-relaxed text-[#6c6c6c]">
              You&apos;ll be charged {today} today for 7-day full access, then{" "}
              {renew} every 30 days unless you cancel before the trial ends.
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#6c6c6c]">
              Annual pricing details are coming soon. Choose 7-Day Limited or
              7-Day Full Access to continue today.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — Pay securely (iframe)
// ─────────────────────────────────────────────────────────────
function PayStep({
  intent,
  onSuccess,
  onFail,
  payFailed,
  retryKey,
  retryLoading,
  onRetry,
}: {
  intent: CheckoutIntent;
  onSuccess: (message?: { order?: { subscription_id?: string } }) => void;
  onFail: () => void;
  payFailed: boolean;
  retryKey: number;
  retryLoading: boolean;
  onRetry: () => void;
}) {
  const today = formatMinor(intent.amountTodayMinor, intent.currency);
  const renew = formatMinor(intent.amountRenewMinor, intent.currency);
  const nextChargeLabel = formatRenewalDate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Left — cream order summary */}
      <div
        className="flex flex-col gap-6 p-6 md:p-8"
        style={{ backgroundColor: CREAM }}
      >
        <BrandLogo />

        <h3 className="pv-heading text-[18px] font-semibold text-[#1a1c21]">
          Order summary
        </h3>

        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-baseline justify-between">
            <p className="pv-heading text-[15px] font-semibold text-[#1a1c21]">
              7-Day Full Access Trial
            </p>
            <p className="pv-heading text-[18px] font-semibold text-[#1a1c21]">
              {today}
            </p>
          </div>
          <p className="mt-0.5 text-[12px] text-[#6c6c6c]">Due today</p>
          <div className="my-4 h-px bg-[#ececec]" />
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] text-[#5c5c5c]">
              After trial ({nextChargeLabel})
            </p>
            <p className="pv-heading text-[15px] font-semibold text-[#1a1c21]">
              {renew} / month
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 text-[13px] text-[#1a1c21]">
          <Feature>Full access to 80+ tools</Feature>
          <Feature>Unlimited edits &amp; downloads</Feature>
          <Feature>Cancel anytime, no questions</Feature>
        </ul>

        <p className="mt-auto flex items-start gap-2 text-[11px] leading-relaxed text-[#6c6c6c]">
          <span aria-hidden>🔒</span>
          Card details never touch our servers. Payments run through a
          PCI-compliant partner.
        </p>
      </div>

      {/* Right — iframe */}
      <div className="flex flex-col gap-4 p-6 md:p-8">
        <div>
          <h3 className="pv-heading text-[22px] font-semibold text-[#1a1c21]">
            Pay securely
          </h3>
          <p className="mt-1 text-[13px] text-[#6c6c6c]">
            Visa, Mastercard, or Amex
          </p>
        </div>

        <div className="rounded-xl">
          {/* `key` bumps on retry so the Solidgate iframe fully remounts
              — otherwise the SDK holds onto its "Payment declined"
              state internally and a second submit is a no-op. */}
          <PaymentForm
            key={retryKey}
            merchantData={{
              merchant: intent.merchant,
              signature: intent.signature,
              paymentIntent: intent.paymentIntent,
            }}
            width="100%"
            onFail={onFail}
            onSuccess={onSuccess}
          />
        </div>

        {payFailed ? (
          <div
            aria-live="polite"
            className="flex flex-col gap-2 rounded-xl border border-danger-200 bg-danger-50 p-4 text-[13px] text-danger-800 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200"
          >
            <p className="font-semibold">
              Your card was declined and hasn&apos;t been charged.
            </p>
            <p>
              Try another card or contact your bank. You can re-enter details
              below.
            </p>
            <button
              className="mt-1 inline-flex h-10 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--pv-brand-red,#f12c23)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#d8241c] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={retryLoading}
              type="button"
              onClick={onRetry}
            >
              {retryLoading ? "Preparing…" : "Try another card"}
            </button>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-[#6c6c6c]">
          By continuing you agree to be charged {today} today, then {renew}{" "}
          every 30 days unless cancelled. See our{" "}
          <a
            className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
            href="/terms-and-conditions"
          >
            Subscription
          </a>{" "}
          &amp;{" "}
          <a
            className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
            href="/refund"
          >
            Refund
          </a>{" "}
          policies.
        </p>

        {process.env.NODE_ENV !== "production" ? (
          <p className="rounded-md bg-warning-50 px-2 py-1.5 text-[11px] text-warning-800 dark:bg-warning-900/30 dark:text-warning-200">
            <strong>Sandbox test card:</strong> 4067 4299 7471 9265 · any future
            expiry · any CVV
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Success
// ─────────────────────────────────────────────────────────────
function SuccessStep({
  intent,
  onFinish,
}: {
  intent: CheckoutIntent;
  onFinish: () => void;
}) {
  const today = formatMinor(intent.amountTodayMinor, intent.currency);
  const renew = formatMinor(intent.amountRenewMinor, intent.currency);
  const nextDate = formatFullRenewalDate();
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Auto-proceed after 2 s so gated actions (downloads, conversions)
  // kick off without requiring an extra click. The user still has the
  // button to proceed immediately.
  useEffect(() => {
    const id = window.setTimeout(() => onFinishRef.current(), 2000);

    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 p-8 text-center">
      <BrandLogo />

      <div
        aria-hidden
        className="relative flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: CREAM_CARD }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pv-brand-red,#f12c23)] text-white">
          <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
            <path
              d="M4 10.5l4 4 8-8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            />
          </svg>
        </span>
      </div>

      <div>
        <h3 className="pv-heading text-[24px] font-semibold text-[#1a1c21]">
          You&apos;re all set!
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[#5c5c5c]">
          Your 7-day trial is active. You now have full access to every PDFVault
          tool.
        </p>
      </div>

      <div
        className="w-full rounded-xl p-4 text-left text-[13px]"
        style={{ backgroundColor: CREAM }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[#5c5c5c]">Plan</span>
          <span className="font-semibold text-[#1a1c21]">
            Full Access · Trial
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[#5c5c5c]">Charged today</span>
          <span className="font-semibold text-[#1a1c21]">{today}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[#5c5c5c]">Next charge</span>
          <span className="font-semibold text-[#1a1c21]">
            {renew} · {nextDate}
          </span>
        </div>
      </div>

      <button
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--pv-brand-red,#f12c23)] text-[15px] font-semibold text-white shadow-[0_10px_20px_-8px_rgba(241,44,35,0.55)] transition-colors hover:bg-[#d8241c]"
        type="button"
        onClick={onFinish}
      >
        Start editing
        <span aria-hidden>→</span>
      </button>
      <a
        className="flex h-[48px] w-full cursor-pointer items-center justify-center rounded-2xl border border-[#ececec] text-[14px] font-medium text-[#1a1c21] transition-colors hover:bg-[#fafafa]"
        href="/dashboard/settings/billing"
      >
        View receipt
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

function BrandLogo() {
  return (
    <Image
      alt="PDFVault"
      className="h-[26px] w-auto object-contain"
      height={26}
      src="/landing/logo-with-text.png"
      width={104}
    />
  );
}

/**
 * Preview panel shown at the top of the plan step when the caller
 * passed a `PaywallPreview`. Renders a blurred, mock document card
 * (we don't actually convert the file until payment succeeds — this
 * is a visual promise, not the real output) with a lock overlay and
 * the source → target format transition. Gives the user a concrete
 * "here is your converted file" moment before they see the price.
 */
function PreviewFileCard({ preview }: { preview: PaywallPreview }) {
  const { filename, sourceExt, targetExt } = preview;
  const badgeColor = (ext: string): string => {
    const normalized = ext.toLowerCase();

    if (normalized === "pdf") return "#e11d48"; // red
    if (["doc", "docx"].includes(normalized)) return "#2563eb"; // blue
    if (["xls", "xlsx"].includes(normalized)) return "#059669"; // green
    if (["ppt", "pptx"].includes(normalized)) return "#ea580c"; // orange
    if (["jpg", "jpeg", "png", "gif"].includes(normalized)) return "#7c3aed"; // purple
    if (["html", "htm"].includes(normalized)) return "#0891b2"; // cyan
    if (normalized === "txt") return "#525252"; // gray

    return "#525252";
  };

  const sourceBadge = badgeColor(sourceExt);
  const targetBadge = badgeColor(targetExt);
  const shortName =
    filename.length > 32 ? `${filename.slice(0, 29)}…` : filename;

  return (
    <div className="relative overflow-hidden rounded-xl border border-black/5 bg-white p-4 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.15)]">
      {/* Blurred mock document preview */}
      <div
        aria-hidden
        className="pointer-events-none flex select-none flex-col gap-1.5"
        style={{ filter: "blur(3px)" }}
      >
        <div className="h-2 w-3/4 rounded bg-[#e5e5e5]" />
        <div className="h-2 w-full rounded bg-[#eaeaea]" />
        <div className="h-2 w-5/6 rounded bg-[#eaeaea]" />
        <div className="h-2 w-2/3 rounded bg-[#e5e5e5]" />
        <div className="h-2 w-full rounded bg-[#eaeaea]" />
        <div className="mt-2 h-16 w-full rounded bg-[#f0f0f0]" />
        <div className="h-2 w-4/5 rounded bg-[#eaeaea]" />
        <div className="h-2 w-3/5 rounded bg-[#e5e5e5]" />
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--pv-brand-red,#f12c23)] text-white shadow-lg">
          <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
            <path
              d="M6 10V7a6 6 0 1 1 12 0v3M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      </div>

      {/* File-name + format transition */}
      <div className="mt-3 flex items-center gap-2 border-t border-[#ececec] pt-3">
        <span
          aria-hidden
          className="inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[10px] font-bold text-white"
          style={{ backgroundColor: sourceBadge }}
        >
          {sourceExt.toUpperCase()}
        </span>
        <p
          className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#1a1c21]"
          title={filename}
        >
          {shortName}
        </p>
        <span aria-hidden className="text-[#9a9a9a]">
          →
        </span>
        <span
          aria-hidden
          className="inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[10px] font-bold text-white"
          style={{ backgroundColor: targetBadge }}
        >
          {targetExt.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--pv-brand-red,#f12c23)] text-[10px] font-bold text-white"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

// Feature bullets shown inside every expanded plan panel. Same list
// for every plan per product spec (2026-07-30 screenshots).
const PLAN_FEATURES = [
  "Unlimited edits",
  "Unlimited downloads",
  "Multi-format conversion",
  "No installation required",
  "Edit text and images in PDF files",
  "Organize and reorder PDF pages",
  "Protect PDF with password",
  "Use PDFVault on mobile",
] as const;

const PLAN_ORDER: readonly PlanId[] = ["trial", "monthly", "annual"] as const;

interface PlanRow {
  id: PlanId;
  title: string;
  price: string;
  priceSuffix?: string;
  badge?: string;
  highlight?: boolean;
}

function PlanAccordion({
  selectedPlan,
  onSelectPlan,
  limitedPrice,
  standardPrice,
  annualPrice,
}: {
  selectedPlan: PlanId;
  onSelectPlan: (id: PlanId) => void;
  limitedPrice: string;
  standardPrice: string;
  annualPrice: string;
}) {
  const plans: PlanRow[] = [
    { id: "trial", title: "7-Day Limited Access", price: limitedPrice },
    {
      id: "monthly",
      title: "7-Day Full Access",
      price: standardPrice,
      badge: "Most popular",
      highlight: true,
    },
    {
      id: "annual",
      title: "Annual Plan",
      price: annualPrice,
      priceSuffix: "per month",
    },
  ];

  return (
    <Accordion
      hideSeparator
      className="flex w-full flex-col gap-3"
      expandedKeys={new Set([selectedPlan])}
      variant="default"
      onExpandedChange={(keys) => {
        // HeroUI Accordion is single-expanded by default. Ignore the
        // empty-set (user collapsed the current) — a paywall always
        // needs one selected plan; the accordion is our source of
        // truth for the picker selection.
        const next = Array.from(keys)[0] as PlanId | undefined;

        if (next && PLAN_ORDER.includes(next)) {
          onSelectPlan(next);
        }
      }}
    >
      {plans.map((plan) => {
        const selected = plan.id === selectedPlan;

        return (
          <Accordion.Item
            key={plan.id}
            className={`relative overflow-hidden rounded-2xl border bg-white transition-colors ${
              selected
                ? "border-2 border-[var(--pv-brand-red,#f12c23)]"
                : "border-[#ececec]"
            }`}
            id={plan.id}
          >
            {plan.badge ? (
              <span
                aria-hidden
                className="absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#fde5c4] px-3 py-0.5 text-[11px] font-semibold text-[#8a5a1a]"
              >
                <span aria-hidden>🚀</span>
                {plan.badge}
              </span>
            ) : null}
            <Accordion.Heading>
              <Accordion.Trigger className="flex w-full items-center gap-4 px-4 py-4 text-start">
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-[var(--pv-brand-red,#f12c23)]"
                      : "border-[#d5d5d5]"
                  }`}
                >
                  {selected ? (
                    <span className="block h-2.5 w-2.5 rounded-full bg-[var(--pv-brand-red,#f12c23)]" />
                  ) : null}
                </span>
                <span className="pv-heading flex-1 text-[15px] font-semibold text-[#1a1c21]">
                  {plan.title}
                </span>
                <span className="flex flex-col items-end leading-none">
                  <span className="pv-heading text-[18px] font-semibold text-[#1a1c21]">
                    {plan.price}
                  </span>
                  {plan.priceSuffix ? (
                    <span className="mt-1 text-[11px] text-[#6c6c6c]">
                      {plan.priceSuffix}
                    </span>
                  ) : null}
                </span>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="px-4 pb-4 pt-0">
                <ul className="flex flex-col gap-2.5 text-[13px] text-[#1a1c21]">
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#e6f5ec] text-[9px] font-bold text-[#0f9d58]"
                      >
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

function TrustPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-[#1a1c21]">
      <span aria-hidden className="text-[#6c6c6c]">
        🔒
      </span>
      {label}
    </span>
  );
}

function CardBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-[#ececec] bg-white px-2 text-[10px] font-semibold text-[#1a1c21]">
      {label}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#ececec] border-t-[var(--pv-brand-red,#f12c23)]" />
      <p className="pv-heading text-sm text-[#5c5c5c]">
        Preparing secure checkout…
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  // A "sign in" error means the checkout intent request came back with
  // 401 — i.e. the user isn't signed in and the paywall can't work for
  // them. Surface a Sign In button so they aren't stuck.
  const needsSignIn = /sign in|not authori[sz]ed|401/i.test(error);

  const goToSignIn = () => {
    if (typeof window === "undefined") return;
    const returnTo = `${window.location.pathname}${window.location.search}`;

    window.location.assign(
      `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`,
    );
  };

  return (
    <div className="flex flex-col gap-3 p-8">
      <h3 className="pv-heading text-[16px] font-semibold text-danger">
        Couldn&apos;t start checkout
      </h3>
      <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">
        {error}
      </p>
      {needsSignIn ? (
        <button
          className="mt-1 inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-[var(--pv-brand-red,#f12c23)] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#d8241c]"
          type="button"
          onClick={goToSignIn}
        >
          Sign in & continue
        </button>
      ) : null}
    </div>
  );
}

function formatMinor(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

// Trial ends 7 days from today. Short label like "Jul 24" for the
// order-summary row.
function formatRenewalDate(): string {
  const d = new Date();

  d.setDate(d.getDate() + 7);

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}

// Long label like "Jul 24, 2026" for the success card.
function formatFullRenewalDate(): string {
  const d = new Date();

  d.setDate(d.getDate() + 7);

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}
