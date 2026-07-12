"use client";

import { useCallback, useState } from "react";

import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";

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
  }, []);

  const onPaymentSuccess = useCallback(async () => {
    setIsOpen(false);
    // Give React one microtask to unmount the modal cleanly before
    // firing the queued action — otherwise a download or router-push
    // can race the modal teardown.
    await Promise.resolve();
    if (pending) {
      try {
        await pending();
      } finally {
        setPending(null);
      }
    }
  }, [pending]);

  return {
    isOpen,
    entitled,
    isLoading,
    guard,
    close,
    onPaymentSuccess,
  };
}
