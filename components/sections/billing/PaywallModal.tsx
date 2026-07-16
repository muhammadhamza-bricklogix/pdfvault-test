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

// Solidgate's iframe loader touches `window` at import time — dynamic
// import with `ssr: false` keeps the Next.js server bundle clean and
// avoids a 500 on the first request.
const PaymentForm = dynamic(
  () => import("@solidgate/react-sdk").then((m) => m.default),
  { ssr: false },
);

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

/**
 * Two-column paywall modal — value proposition on the left, Solidgate
 * iframe on the right. Collapses to a single column on mobile so the
 * iframe stays legible on narrow viewports.
 *
 * Flow:
 *   1. On open, POST /billing/checkout-intent to get merchant data.
 *   2. Left column renders the price card + feature list + trust row.
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
    // Sync pulls the latest state straight from Solidgate REST and
    // upserts locally so the dashboard reflects reality immediately.
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
      <Modal.Container>
        <Modal.Dialog className="w-[min(880px,calc(100vw-32px))] sm:!max-w-[880px]">
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
    <div className="flex flex-col gap-5 rounded-t-[inherit] bg-gradient-to-br from-[#fff5f4] to-[#ffeceb] p-6 md:rounded-l-[inherit] md:rounded-tr-none md:p-7 dark:from-[#2a1613] dark:to-[#331915]">
      <div>
        <span className="inline-flex h-6 items-center rounded-full bg-white/70 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--pv-brand-red,#de472e)] dark:bg-black/40">
          Limited-time offer
        </span>
        <h2 className="mt-3 text-[22px] font-bold leading-tight text-default-900 sm:text-[24px]">
          Unlock the full PDFVault toolkit
        </h2>
        <p className="mt-1 text-[13px] text-default-600">
          Everything you need to convert, share, and edit — in one place.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-black/30 dark:ring-white/5">
        <div className="flex items-baseline gap-2">
          <span className="text-[36px] font-bold leading-none text-default-900">
            {today}
          </span>
          <span className="text-[13px] font-medium text-default-500">
            today
          </span>
        </div>
        <p className="mt-2 text-[13px] text-default-600">
          7-day trial, then <span className="font-semibold">{renew}/month</span>
          . Cancel anytime.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 text-[13px] text-default-700">
        <Feature>Convert PDF to Word, Excel, PowerPoint, JPG, PNG</Feature>
        <Feature>Merge, split, compress and organize pages</Feature>
        <Feature>Password-protect and share via secure links</Feature>
        <Feature>Extract images and edit text inline</Feature>
        <Feature>Unlimited edits + priority processing</Feature>
      </ul>

      <div className="mt-auto flex flex-col gap-2 text-[11px] text-default-500">
        <div className="flex flex-wrap items-center gap-3">
          <TrustBadge label="SSL secure checkout" />
          <TrustBadge label="Cancel anytime" />
          <TrustBadge label="30-day support" />
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
  onSuccess: () => void;
  onFail: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-6 md:p-7">
      <div>
        <h3 className="text-[16px] font-semibold text-default-900">
          Pay securely
        </h3>
        <p className="mt-0.5 text-[12px] text-default-500">
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
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--pv-brand-red,#de472e)] text-[10px] font-bold text-white"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function TrustBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 font-medium text-default-700 dark:bg-black/30 dark:text-default-300">
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
          className="inline-flex h-6 items-center rounded border border-default-200 bg-white px-2 text-[10px] font-semibold text-default-700 dark:border-default-700 dark:bg-black/40 dark:text-default-300"
        >
          {m}
        </span>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-default-200 border-t-[var(--pv-brand-red,#de472e)]" />
      <p className="text-sm text-default-600">Preparing secure checkout…</p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-3 p-8">
      <h3 className="text-[16px] font-semibold text-danger">
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
