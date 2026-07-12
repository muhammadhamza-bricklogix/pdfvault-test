"use client";

import type { PaywallOutcome } from "./paywall-bus";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";

import { setPaywallHandler } from "./paywall-bus";

/**
 * Central controller for the paywall modal. A caller (Download button,
 * Convert action, Share creator, etc.) wraps its action in
 * `guard(async () => runAction())`. When the user is already entitled
 * the action runs immediately. Otherwise the modal opens and — once the
 * iframe fires `success` — the queued action resumes automatically.
 *
 * The queued action is stored as a ref so it survives the async gap
 * between modal-open and payment-success. Only one action can be
 * queued at a time; a second guard() call replaces the first (the
 * user re-clicked, so respect their latest intent).
 */
export function usePaywall() {
  const { data: subscription, isLoading } = useSubscriptionQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(
    null,
  );
  // When a paywall opens because the API interceptor asked for it, the
  // resolver settles the promise back in the axios pipeline so the
  // failed request can be retried after payment. Ref so the current
  // resolver survives re-renders between open and close.
  const busResolverRef = useRef<((outcome: PaywallOutcome) => void) | null>(
    null,
  );

  const entitled = subscription?.entitled ?? false;

  const guard = useCallback(
    async (action: () => void | Promise<void>) => {
      if (isLoading) return;

      if (entitled) {
        await action();

        return;
      }
      setPending(() => action);
      setIsOpen(true);
    },
    [entitled, isLoading],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setPending(null);
    // Notify the bus-side promise that the user bailed so the axios
    // interceptor can reject with PaywallCancelledError instead of
    // hanging forever.
    if (busResolverRef.current) {
      busResolverRef.current("cancelled");
      busResolverRef.current = null;
    }
  }, []);

  const onPaymentSuccess = useCallback(async () => {
    setIsOpen(false);
    // Give React one microtask to unmount the modal cleanly before
    // firing the queued action — otherwise a download or router-push
    // can race the modal teardown.
    await Promise.resolve();
    if (busResolverRef.current) {
      busResolverRef.current("success");
      busResolverRef.current = null;
    }
    if (pending) {
      try {
        await pending();
      } finally {
        setPending(null);
      }
    }
  }, [pending]);

  // Wire this modal into the module-level paywall bus so non-React
  // callers (axios interceptor, service helpers) can trigger it. The
  // handler returns a promise that settles when the user pays or
  // closes.
  useEffect(() => {
    setPaywallHandler(
      () =>
        new Promise<PaywallOutcome>((resolve) => {
          if (entitled) {
            resolve("success");

            return;
          }
          busResolverRef.current = resolve;
          setIsOpen(true);
        }),
    );

    return () => setPaywallHandler(null);
  }, [entitled]);

  return {
    isOpen,
    entitled,
    isLoading,
    guard,
    close,
    onPaymentSuccess,
  };
}
