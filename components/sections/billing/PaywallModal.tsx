"use client";

import type { CheckoutIntent } from "@/lib/shared/types/billing.types";

import { Modal } from "@heroui/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import {
  useCreateCheckoutIntentMutation,
  useInvalidateSubscription,
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
 * "Last step to unlock your file" — boots the Solidgate Payment Form
 * for the primary trial plan when a non-entitled user hits a gated
 * action. Called by `usePaywall.guard`.
 *
 * Flow:
 *   1. On open, POST /billing/checkout-intent to get merchant data.
 *   2. Render `<PaymentForm merchantData={...} />` — the iframe boots
 *      inside the modal body. Card data never touches our JS bundle.
 *   3. On `success` iframe event: invalidate the subscription cache and
 *      resume the caller's queued action via `onPaymentSuccess`.
 *   4. On `fail`: toast + keep modal open so the user can retry.
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

    // Cleanup fires when isOpen flips back to false OR the modal
    // unmounts — clears stale intent + error so the next open re-fetches
    // a fresh signed envelope instead of showing yesterday's numbers.
    return () => {
      setIntent(null);
      setError(null);
    };
    // Depending only on `isOpen`: a stable mutation identity change
    // would double-fire the intent request.
  }, [isOpen]);

  const handleIframeSuccess = () => {
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
        <Modal.Dialog className="sm:max-w-[520px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Last step to unlock your file</Modal.Heading>
            <p className="mt-1 text-xs text-default-500">
              7-day trial for{" "}
              {intent
                ? formatMinor(intent.amountTodayMinor, intent.currency)
                : "$0.99"}
            </p>
          </Modal.Header>
          <Modal.Body>
            {error ? (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : !intent ? (
              <p className="py-8 text-center text-sm text-default-500">
                Preparing secure checkout…
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <DisclaimerBlock
                  amountRenewMinor={intent.amountRenewMinor}
                  amountTodayMinor={intent.amountTodayMinor}
                  currency={intent.currency}
                  intervalLabel="30 days"
                />
                <PaymentForm
                  merchantData={{
                    merchant: intent.merchant,
                    signature: intent.signature,
                    paymentIntent: intent.paymentIntent,
                  }}
                  width="100%"
                  onFail={handleIframeFail}
                  onSuccess={handleIframeSuccess}
                />
              </div>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function formatMinor(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}
