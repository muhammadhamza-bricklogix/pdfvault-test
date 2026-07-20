"use client";

import type { PaywallOutcome, PaywallPreview } from "./paywall-bus";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { dispatchSignInPrompt } from "@/components/shared/sign-in-prompt-modal";
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
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<PaywallPreview | null>(null);
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
    setPreview(null);
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
    setPreview(null);
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
  //
  // Signed-out callers get the sign-in prompt modal instead — the
  // paywall itself can't work for anon users (POST /billing/checkout-intent
  // requires an authenticated user) and would just render the
  // "You need to sign in to continue" error state with no way out.
  useEffect(() => {
    setPaywallHandler(
      (incomingPreview?: PaywallPreview) =>
        new Promise<PaywallOutcome>((resolve) => {
          if (entitled) {
            resolve("success");

            return;
          }
          if (authLoaded && !isSignedIn) {
            const returnTo =
              typeof window === "undefined"
                ? "/"
                : `${window.location.pathname}${window.location.search}`;

            dispatchSignInPrompt({
              title: "Sign in to continue",
              description:
                "This action requires an account. Sign in and we'll bring you back to finish where you left off.",
              confirmLabel: "Sign in & continue",
              redirectUrl: returnTo,
            });
            resolve("cancelled");

            return;
          }
          busResolverRef.current = resolve;
          setPreview(incomingPreview ?? null);
          setIsOpen(true);
        }),
    );

    return () => setPaywallHandler(null);
  }, [authLoaded, entitled, isSignedIn]);

  return {
    isOpen,
    entitled,
    isLoading,
    guard,
    preview,
    close,
    onPaymentSuccess,
  };
}
