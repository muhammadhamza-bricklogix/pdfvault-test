"use client";

import type {
  PaywallOutcome,
  PaywallPreview,
  PaywallRequestOptions,
} from "./paywall-bus";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

import { isEntitledSnapshot } from "./entitlement-cache";
import { useIsEntitlementAllowlisted } from "./use-entitlement-allowlist";
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
  const allowlisted = useIsEntitlementAllowlisted();
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<PaywallPreview | null>(null);
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(
    null,
  );
  // Always render the full two-column modal. When there is no doc
  // context (dashboard "Upgrade" buttons, billing settings, axios
  // interceptor) the left column falls back to `<GenericPreviewCard />`
  // — a blurred generic value-prop card — so the plan picker never
  // ships alone. Caller-supplied `hidePreview` is ignored on purpose.
  const hidePreview = false;
  // When a paywall opens because the API interceptor asked for it, the
  // resolver settles the promise back in the axios pipeline so the
  // failed request can be retried after payment. Ref so the current
  // resolver survives re-renders between open and close.
  const busResolverRef = useRef<((outcome: PaywallOutcome) => void) | null>(
    null,
  );

  const entitled = allowlisted || isEntitledSnapshot(subscription);

  const guard = useCallback(
    async (action: () => void | Promise<void>) => {
      if (isLoading) return;

      if (entitled) {
        logger.breadcrumb("paywall", "guard.entitled_skip");
        await action();

        return;
      }
      logger.event(EVENTS.PAYWALL_OPENED, "info", { source: "guard" });
      setPending(() => action);
      setIsOpen(true);
    },
    [entitled, isLoading],
  );

  const close = useCallback(() => {
    logger.event(EVENTS.PAYWALL_CANCELLED, "info", {
      hasBusResolver: Boolean(busResolverRef.current),
      hasPendingAction: Boolean(pending),
    });
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
  }, [pending]);

  const onPaymentSuccess = useCallback(async () => {
    logger.event(EVENTS.PAYWALL_PAYMENT_SUCCESS, "info", {
      hasPendingAction: Boolean(pending),
      hasBusResolver: Boolean(busResolverRef.current),
    });
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
        logger.event(EVENTS.PAYWALL_PENDING_ACTION_OK, "info");
      } finally {
        // The pending action (e.g. useExportEditor.handleExport) owns
        // its own error capture and user-facing toast — re-capturing
        // here would double-fire the same error in Sentry.
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
      (incomingPreview?: PaywallPreview, options?: PaywallRequestOptions) =>
        new Promise<PaywallOutcome>((resolve) => {
          if (entitled) {
            logger.breadcrumb("paywall", "bus.entitled_skip");
            resolve("success");

            return;
          }
          if (authLoaded && !isSignedIn) {
            logger.event(EVENTS.PAYWALL_BUS_SIGNIN_PROMPT, "info");
            const returnTo =
              typeof window === "undefined"
                ? "/"
                : `${window.location.pathname}${window.location.search}`;

            // Signed-out paywall trigger — open AuthModal directly.
            // Preserves item #5's intent (route signed-out users
            // through auth before the paywall's `/billing/checkout-intent`
            // POST, which needs a JWT). Cards' finalize still does
            // `window.location.assign(returnTo)` (item #15), so the
            // guarded action re-fires from the queued caller after
            // signin, same as before.
            dispatchAuthModal({
              mode: "login",
              redirectUrl: returnTo,
            });
            resolve("cancelled");

            return;
          }
          logger.event(EVENTS.PAYWALL_OPENED, "info", {
            source: "bus",
            hasPreview: Boolean(incomingPreview),
            // Caller hint retained for telemetry; route decides display.
            callerHidePreview: options?.hidePreview ?? false,
          });
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
    hidePreview,
    close,
    onPaymentSuccess,
  };
}
