"use client";

import type { CheckoutIntent } from "@/lib/shared/types/billing.types";

import { Modal } from "@heroui/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { setEntitledSnapshot } from "@/lib/client/hooks/billing/entitlement-cache";
import {
  useCreateCheckoutIntentMutation,
  useInvalidateSubscription,
  useSyncSubscriptionMutation,
} from "@/lib/client/query/mutations/billing.mutation";
import { DISCLAIMER_VERSION } from "@/lib/shared/constants/billing";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

import { DisclaimerBlock } from "./DisclaimerBlock";

// The payment SDK's iframe loader touches `window` at import time —
// dynamic import with `ssr: false` keeps the Next.js server bundle clean
// and avoids a 500 on the first request.
const PaymentForm = dynamic(
  () => import("@solidgate/react-sdk").then((m) => m.default),
  { ssr: false },
);

const RETENTION_DAYS = 30;

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

/**
 * Two-column payment modal — value proposition on the left, payment
 * processor iframe on the right. Collapses to a single column on mobile
 * so the iframe stays legible on narrow viewports.
 *
 * Styling comes from the app's --pv-* tokens (see globals.css) so the
 * shell feels native next to the dashboard and settings surfaces. The
 * checkout wiring (`useCreateCheckoutIntentMutation` +
 * `handleIframeSuccess`) is unchanged from the previous version — this
 * pass is a visual refresh + a data-retention notice, not a flow change.
 *
 * Flow:
 *   1. On open, POST /billing/checkout-intent to get merchant data.
 *   2. Left column renders the price card + feature list + retention +
 *      trust row.
 *   3. Right column boots `<PaymentForm merchantData={...} />` inside
 *      an iframe. Card data never touches our JS bundle.
 *   4. On `success` iframe event: invalidate the subscription cache and
 *      resume the caller's queued action via `onPaymentSuccess`.
 */
export function PaywallModal({
  isOpen,
  onClose,
  onPaymentSuccess,
}: PaywallModalProps) {
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createIntent = useCreateCheckoutIntentMutation();
  const invalidateSubscription = useInvalidateSubscription();
  const syncSubscription = useSyncSubscriptionMutation();

  useEffect(() => {
    if (!isOpen) return;

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
    };
    // Depending only on `isOpen`: a stable mutation identity change
    // would double-fire the intent request.
  }, [isOpen]);

  const handleIframeSuccess = async (message?: {
    order?: { subscription_id?: string };
  }) => {
    // Optimistically flip the module snapshot so the queued gated
    // request that this modal was gating doesn't re-fire the paywall
    // when it resumes. The real subscription query catches up on the
    // next tick and overwrites this if we were wrong somehow.
    setEntitledSnapshot(true);

    const subscriptionId = message?.order?.subscription_id;

    // Belt-and-suspenders sync: the webhook is the source of truth in
    // production, but during local dev + demos it may not be routable.
    // Sync pulls the latest state straight from the processor's REST API
    // and upserts locally so the dashboard reflects reality immediately.
    // Passing the subscription_id from the iframe success event skips
    // the customer-scoped list lookup — much more reliable.
    try {
      await syncSubscription.mutateAsync(
        subscriptionId ? { subscriptionId } : {},
      );
    } catch (err) {
      logger.warn?.("subscription sync after payment failed", err);
    }
    void invalidateSubscription();
    toast.success({
      title: "Payment received",
      description: "Your access is unlocked.",
    });
    onPaymentSuccess();
  };

  const handleIframeFail = () => {
    toast.error({
      title: "Payment failed",
      description: "Try a different card or method.",
    });
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className="items-center justify-center p-4">
        <Modal.Dialog className="w-[min(920px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:!max-w-[920px] dark:bg-content1">
          <Modal.CloseTrigger />
          {error ? (
            <ErrorState error={error} />
          ) : !intent ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ValueColumn intent={intent} />
              <PaymentColumn
                intent={intent}
                onFail={handleIframeFail}
                onSuccess={handleIframeSuccess}
              />
            </div>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ValueColumn({ intent }: { intent: CheckoutIntent }) {
  const today = formatMinor(intent.amountTodayMinor, intent.currency);
  const renew = formatMinor(intent.amountRenewMinor, intent.currency);

  return (
    <div className="flex flex-col gap-6 bg-[#f7f7f7] p-6 md:p-8 dark:bg-content2">
      <div>
        <span className="inline-flex h-6 items-center rounded-full bg-white dark:bg-content1 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--pv-brand-red)]">
          Limited-time offer
        </span>
        <h2 className="pv-heading mt-3 text-[22px] font-semibold leading-tight text-[var(--pv-text-strong)] sm:text-[24px]">
          Unlock the full PDFVault toolkit
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug text-[var(--pv-text-body)]">
          Everything you need to convert, share, edit, and organize — in one
          workspace.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--pv-hairline)] bg-white dark:bg-content1 p-5 shadow-sm">
        <div className="flex items-baseline gap-2">
          <span className="pv-heading text-[36px] font-semibold leading-none text-[var(--pv-text-strong)]">
            {today}
          </span>
          <span className="text-[13px] font-medium text-[var(--pv-text-muted)]">
            today
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-[var(--pv-text-body)]">
          7-day trial, then{" "}
          <span className="font-semibold text-[var(--pv-text-strong)]">
            {renew}/month
          </span>
          . Cancel anytime from Settings.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 text-[13px] text-[var(--pv-text-body)]">
        <Feature>Convert PDF to Word, Excel, PowerPoint, JPG, PNG</Feature>
        <Feature>Merge, split, compress, and organize pages</Feature>
        <Feature>Password-protect and share via secure links</Feature>
        <Feature>Extract images and edit text inline</Feature>
        <Feature>Unlimited edits + priority processing</Feature>
      </ul>

      <RetentionNotice days={RETENTION_DAYS} />

      <div className="mt-auto flex flex-col gap-2 text-[11px] text-[var(--pv-text-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <TrustBadge label="SSL checkout" />
          <TrustBadge label="Cancel anytime" />
          <TrustBadge label={`${RETENTION_DAYS}-day retention`} />
        </div>
        <p>
          Card details never touch our servers. All payments run through a
          PCI-compliant partner.
        </p>
      </div>
    </div>
  );
}

function PaymentColumn({
  intent,
  onSuccess,
  onFail,
}: {
  intent: CheckoutIntent;
  onSuccess: (message?: { order?: { subscription_id?: string } }) => void;
  onFail: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 bg-white dark:bg-content1 p-6 md:p-8">
      <div>
        <h3 className="pv-heading text-[16px] font-semibold text-[var(--pv-text-strong)]">
          Pay securely
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--pv-text-muted)]">
          Apple Pay, Google Pay, or card
        </p>
      </div>

      <PaymentMethodBadges />

      <PaymentForm
        merchantData={{
          merchant: intent.merchant,
          signature: intent.signature,
          paymentIntent: intent.paymentIntent,
        }}
        width="100%"
        onFail={onFail}
        onSuccess={onSuccess}
      />

      <DisclaimerBlock
        amountRenewMinor={intent.amountRenewMinor}
        amountTodayMinor={intent.amountTodayMinor}
        currency={intent.currency}
        intervalLabel="30 days"
      />

      {process.env.NODE_ENV !== "production" ? (
        <p className="rounded-md bg-warning-50 px-2 py-1.5 text-[11px] text-warning-800 dark:bg-warning-900/30 dark:text-warning-200">
          <strong>Sandbox test card:</strong> 4067 4299 7471 9265 · any future
          expiry · any CVV
        </p>
      ) : null}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--pv-brand-red)] text-[10px] font-bold text-white"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Data retention block — surfaces the fact that we hold on to a user's
 * files for a while after any cancellation so nothing is lost. This copy
 * pairs with the matching retention badge below and appears in the
 * settings > billing cancel flow, so wording stays consistent.
 */
function RetentionNotice({ days }: { days: number }) {
  return (
    <div className="rounded-xl border border-[var(--pv-hairline)] bg-white dark:bg-content1 p-3.5">
      <p className="text-[12px] font-semibold text-[var(--pv-text-strong)]">
        Your files stay safe
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--pv-text-body)]">
        If you cancel, we keep your PDFs in your account for{" "}
        <span className="font-semibold text-[var(--pv-text-strong)]">
          {days} days
        </span>{" "}
        so you can resubscribe or download without losing work.
      </p>
    </div>
  );
}

function TrustBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-content1 px-2 py-1 font-medium text-[var(--pv-text-body)]">
      <span aria-hidden className="text-emerald-600">
        🔒
      </span>
      {label}
    </span>
  );
}

function PaymentMethodBadges() {
  const methods = ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay"];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {methods.map((m) => (
        <span
          key={m}
          className="inline-flex h-6 items-center rounded border border-[var(--pv-hairline)] bg-white dark:bg-content1 px-2 text-[10px] font-semibold text-[var(--pv-text-body)]"
        >
          {m}
        </span>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-content1 p-10">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--pv-hairline)] border-t-[var(--pv-brand-red)]" />
      <p className="pv-heading text-sm text-[var(--pv-text-body)]">
        Preparing secure checkout…
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-3 bg-white dark:bg-content1 p-8">
      <h3 className="pv-heading text-[16px] font-semibold text-danger">
        Couldn&apos;t start checkout
      </h3>
      <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">
        {error}
      </p>
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
