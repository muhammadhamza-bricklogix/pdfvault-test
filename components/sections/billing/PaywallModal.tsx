"use client";

import type { CheckoutIntent, Invoice } from "@/lib/shared/types/billing.types";
import type { PaywallPreview } from "@/lib/client/hooks/billing/paywall-bus";

import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Modal } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiAmericanexpress, SiJcb, SiVisa } from "react-icons/si";

import {
  generateReceiptPdf,
  receiptFileName,
} from "@/lib/client/billing/generate-receipt-pdf";
import {
  useCreateCheckoutIntentMutation,
  useSyncSubscriptionMutation,
} from "@/lib/client/query/mutations/billing.mutation";
import { billingService } from "@/lib/shared/api/services/billing.service";
import { DISCLAIMER_VERSION } from "@/lib/shared/constants/billing";
import { billingKeys } from "@/lib/shared/constants/query-keys";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { formatMinor } from "@/lib/shared/utils/currency";
import { persistUserCurrency } from "@/lib/client/billing/user-currency";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

// The payment SDK's iframe loader touches `window` at import time —
// dynamic import with `ssr: false` keeps the Next.js server bundle
// clean and avoids a 500 on the first request.
//
// SdkLoader.load(chargeAuthCdnUrl) swaps the underlying form runtime
// from the legacy solid-form.js to charge-auth.js. charge-auth handles
// 3DS challenges via a proper redirect flow rather than a nested
// iframe layered on top of the payment form — which fixes the modal
// focus/click issue where the 3DS OTP prompt appeared above the form
// but wasn't interactable because our modal's focus scope trapped
// keyboard input on the underlying iframe. Awaiting the load call
// inside the dynamic import guarantees PaymentForm never renders
// against the old runtime.
const PaymentForm = dynamic(
  async () => {
    const m = await import("@solidgate/react-sdk");

    await m.SdkLoader.load("https://cdn.charge-auth.com/js/form.js");

    return m.default;
  },
  { ssr: false },
);

const CREAM = "#fdf3f0";
const CREAM_CARD = "#fef5f1";

// Wallet button styling passed to the Solidgate SDK. Black on both to
// match Apple's HIG default and read well against the modal's white
// background. Update `color` here — Solidgate maps these onto the
// respective platform button APIs (PaymentButton / PKPaymentButton).
// `enabled: true` is set explicitly because the SDK defaults it to
// undefined/false when the params object is present but omits the
// key; without it the button silently never mounts even after the
// Apple domain is verified.
//
// Google + Apple Pay both render the bare brand tile (2026-09-03
// PM ask: match PDF Guru's checkout — no "Subscribe with" prefix).
// Google Pay `type: "plain"` shows just "G Pay" (plus a linked
// card indicator when Google Pay auto-detects one). Apple Pay
// stays on `type: "plain"` for the same "Pay" glyph-only render.
const GOOGLE_PAY_BUTTON_PARAMS = {
  enabled: true,
  color: "black",
  type: "plain",
} as const;
const APPLE_PAY_BUTTON_PARAMS = {
  enabled: true,
  integrationType: "js",
  type: "plain",
  color: "black",
} as const;

type Step = "plan" | "pay" | "success";
type PlanId = "monthly" | "annual";

// Stable, memoised wrapper around Solidgate's <PaymentForm>. PayStep
// re-renders each time a wallet MutationObserver fires
// (`applePayReady`, `googlePayReady`, `walletTimedOut`) — three
// re-renders that all fall within the window when the user is typing
// their card. When the parent re-renders <PaymentForm>, the SDK's
// internal useIsomorphicLayoutEffect re-runs `getInitConfig()` and
// re-checks a JSON.stringify key. Any subtle instability in that key
// re-invokes `SdkLoader.init(config)`, which re-mounts the iframe and
// resets focus to the card number field — the QA-reported "cursor
// jumps back to card number while typing expiry" (2026-09-07).
//
// Memoising with primitive-only props (merchant / signature /
// paymentIntent) + stable ref objects + parent-owned callbacks makes
// PayStep re-renders inert for the Solidgate iframe: React.memo skips
// the render entirely, so the SDK layout effect doesn't fire and can't
// steal focus. Isolated to the iframe subtree — no auth-chain impact.
interface StablePaymentFormProps {
  applePayContainerRef: React.RefObject<HTMLDivElement | null>;
  googlePayContainerRef: React.RefObject<HTMLDivElement | null>;
  merchant: string;
  signature: string;
  paymentIntent: string;
  retryKey: number;
  onFail: () => void;
  onSuccess: (message?: { order?: { subscription_id?: string } }) => void;
}

const StablePaymentForm = memo(function StablePaymentForm({
  applePayContainerRef,
  googlePayContainerRef,
  merchant,
  signature,
  paymentIntent,
  retryKey,
  onFail,
  onSuccess,
}: StablePaymentFormProps) {
  const merchantData = useMemo(
    () => ({ merchant, signature, paymentIntent }),
    [merchant, signature, paymentIntent],
  );
  const handleError = useCallback((error: unknown) => {
    logger.captureError(error, "checkout.iframe_error");
  }, []);
  const handleMounted = useCallback(() => {
    logger.info("[paywall] Solidgate iframe mounted");
  }, []);

  return (
    <PaymentForm
      key={`${retryKey}-${paymentIntent}`}
      applePayButtonParams={APPLE_PAY_BUTTON_PARAMS}
      applePayContainerRef={applePayContainerRef}
      googlePayButtonParams={GOOGLE_PAY_BUTTON_PARAMS}
      googlePayContainerRef={googlePayContainerRef}
      merchantData={merchantData}
      width="100%"
      onError={handleError}
      onFail={onFail}
      onMounted={handleMounted}
      onSuccess={onSuccess}
    />
  );
});

interface PaywallModalProps {
  isOpen: boolean;
  /**
   * Optional preview of the file the user is trying to unlock — e.g.
   * the source Word doc on `/convert/word-to-pdf`. Rendered above the
   * plan picker as a blurred file card so the user sees "here is your
   * converted file" before paying. Falls back to a generic blurred
   * "document is ready" card when undefined (axios interceptor path,
   * generic downloads).
   */
  preview: PaywallPreview | null;
  /**
   * Suppress the entire left preview column and render the plan picker
   * on its own. Set by billing settings ("Add billing method") where
   * there is no document context to preview.
   */
  hidePreview?: boolean;
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
  hidePreview = false,
  onClose,
  onPaymentSuccess,
}: PaywallModalProps) {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("monthly");
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  // Fetched in parallel with the primary (monthly) intent so the
  // plan-picker card shows the same annual per-month price the payment
  // step will later render. `intent.alternatePlans[ANNUAL]` was drifting
  // from the standalone ANNUAL intent in some geos, producing a
  // different figure on the two screens. Reusing this cached intent on
  // Continue also skips the extra round-trip.
  const [annualIntent, setAnnualIntent] = useState<CheckoutIntent | null>(null);
  // Explicit "backend rejected the ANNUAL pre-fetch" flag — the
  // primary intent's alternatePlans is the source of truth for whether
  // annual is seeded, but this flag lets us hide the card immediately
  // when the pre-fetch 404s even if alternatePlans hasn't proven it
  // yet. Prevents the "£1.65/mo" mis-quote (monthly price divided by
  // 12) and the "Couldn't start annual checkout — Resource not found"
  // dead-end on Continue.
  const [annualUnavailable, setAnnualUnavailable] = useState(false);
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

  // Keep Solidgate's Apple Pay / Google Pay portal overlays interactive.
  // charge-auth.js injects the Apple Pay QR modal as a NEW div into
  // document.body (not an iframe). React Aria's useModalOverlay passes
  // shouldUseInert: true to ariaHideOutside, which watches for new body
  // children and immediately marks them `inert` — blocking every click,
  // scroll, and keyboard event including the overlay's own X button.
  //
  // Fix: snapshot pre-existing body children when the modal opens, then
  // watch for any NEW body-level child that gets marked inert by React
  // Aria and immediately strip it.
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    // Snapshot taken at modal-open time. Anything added after this is a
    // third-party portal (Solidgate QR overlay, wallet sheet, etc.).
    const preExistingChildren = new Set(document.body.children);

    const unInertNewPortals = () => {
      for (const child of Array.from(document.body.children)) {
        if (preExistingChildren.has(child)) continue;
        const el = child as HTMLElement;

        // Only fix elements that React Aria actually marked inert/hidden.
        if (!el.inert && el.getAttribute("aria-hidden") !== "true") continue;
        el.inert = false;
        el.removeAttribute("aria-hidden");
        el.style.pointerEvents = "auto";
        el.style.zIndex = "2147483647";
      }
    };

    const observer = new MutationObserver(unInertNewPortals);

    observer.observe(document.body, {
      attributeFilter: ["inert", "aria-hidden"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    unInertNewPortals();

    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep("plan");

    setSelectedPlan("monthly");

    // Modal lifecycle milestone — fires exactly once per open (isOpen
    // flip). Landmark for the CloudWatch/Sentry trace: any subsequent
    // failure in this session's paywall chain is a descendant of this
    // event. Includes preview shape so we can slice failures by
    // originating export path (pdf / docx / xlsx / no-preview).
    logger.event(EVENTS.PAYWALL_MODAL_MOUNT, "info", {
      hasPreview: Boolean(preview),
      hidePreview,
      sourceExt: preview?.sourceExt,
      targetExt: preview?.targetExt,
      hasPreviewObjectUrl: Boolean(preview?.previewObjectUrl),
    });

    logger.event(EVENTS.CHECKOUT_INTENT_START, "info", {
      plan: "monthly",
      // Diagnostic — Microsoft's automated bots repro a
      // "Couldn't start checkout / Invalid request." 400 that the team
      // cannot reproduce manually. Without capturing the payload +
      // client context at start-of-flight we can't tell if the fault is
      // an empty fileName, garbage click IDs, an auth-hydration race,
      // or a Solidgate fraud rule (see /Users/softaims/.claude/plans
      // for the full triage). Log only shape, not PII.
      fileNameLength: preview?.filename?.length ?? 0,
      fileNameEmpty: !preview?.filename,
      hasPreview: Boolean(preview),
      sourceExt: preview?.sourceExt,
      targetExt: preview?.targetExt,
    });
    createIntent.mutate(
      {
        disclaimerVersion: DISCLAIMER_VERSION,
        fileName: preview?.filename,
      },
      {
        onSuccess: (intent) => {
          logger.event(EVENTS.CHECKOUT_INTENT_OK, "info", {
            currency: intent.currency,
            amountTodayMinor: intent.amountTodayMinor,
            amountRenewMinor: intent.amountRenewMinor,
            alternatePlans: intent.alternatePlans,
          });
          // Mirror the region-correct currency into localStorage so the
          // billing table + receipt PDF can display the actual charged
          // currency even when the backend's Payment writer defaults to
          // "USD". See `lib/client/billing/user-currency.ts`.
          persistUserCurrency(intent.currency);
          setIntent(intent);
        },
        onError: (err) => {
          // Enriched forensic log — captures the raw non-enveloped 400
          // body (`ApiError.rawBody`, populated in `api-error.ts`),
          // whatever the backend actually said, plus enough client
          // context to distinguish bot vs. human sessions after the
          // fact. This is the piece missing today; without it every
          // future "Invalid request." report is another round of
          // guessing.
          //
          // Structured under `event="checkout_intent_400"` so we can
          // query Sentry (or console logs) directly for it.
          const apiErr = err as {
            statusCode?: number;
            message?: string;
            rawBody?: string;
          };
          const cioClickIds = (() => {
            if (typeof document === "undefined") return {};
            const cookie = document.cookie;

            return {
              hasGclid: /(?:^|;\s*)pdfvault_gclid=/.test(cookie),
              hasGbraid: /(?:^|;\s*)pdfvault_gbraid=/.test(cookie),
              hasWbraid: /(?:^|;\s*)pdfvault_wbraid=/.test(cookie),
              hasClickTs: /(?:^|;\s*)pdfvault_gclick_ts=/.test(cookie),
            };
          })();
          const clientHints =
            typeof window !== "undefined"
              ? {
                  userAgent: navigator.userAgent?.slice(0, 300),
                  language: navigator.language,
                  timezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone ??
                    "unknown",
                  referrer: document.referrer?.slice(0, 300) ?? "",
                  innerWidth: window.innerWidth,
                  innerHeight: window.innerHeight,
                  path: window.location.pathname + window.location.search,
                }
              : {};

          // eslint-disable-next-line no-console
          console.error("[PaywallModal] checkout_intent_400", {
            event: "checkout_intent_400",
            statusCode: apiErr?.statusCode,
            errorMessage: apiErr?.message,
            rawBody: apiErr?.rawBody?.slice(0, 2048),
            payload: {
              disclaimerVersion: DISCLAIMER_VERSION,
              fileNameLength: preview?.filename?.length ?? 0,
              fileNameEmpty: !preview?.filename,
              fileNameFirstChars: preview?.filename?.slice(0, 40),
              hasPreview: Boolean(preview),
              sourceExt: preview?.sourceExt,
              targetExt: preview?.targetExt,
            },
            cookies: cioClickIds,
            client: clientHints,
          });

          // Named event so CloudWatch/Sentry has a queryable failure
          // milestone (search by `event_name:checkout.intent_error`)
          // in addition to the raw exception. Fired at warning level so
          // it's captureMessage-promoted rather than a silent breadcrumb.
          logger.event(EVENTS.CHECKOUT_INTENT_ERROR, "warning", {
            statusCode: apiErr?.statusCode,
            errorMessage: apiErr?.message,
            fileNameLength: preview?.filename?.length ?? 0,
            fileNameEmpty: !preview?.filename,
            sourceExt: preview?.sourceExt,
            targetExt: preview?.targetExt,
            ...cioClickIds,
          });

          logger.captureError(err, "checkout.intent", {
            statusCode: apiErr?.statusCode,
            errorMessage: apiErr?.message,
            rawBody: apiErr?.rawBody?.slice(0, 2048),
            fileNameLength: preview?.filename?.length ?? 0,
            fileNameEmpty: !preview?.filename,
            sourceExt: preview?.sourceExt,
            targetExt: preview?.targetExt,
            ...cioClickIds,
            userAgent: clientHints.userAgent,
            timezone: clientHints.timezone,
            language: clientHints.language,
          });
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't start checkout. Please try again.",
          );
        },
      },
    );

    // Fire the annual intent alongside the monthly one. The plan
    // picker uses its `amountRenewMinor` so the per-month price shown
    // on the picker matches exactly what the payment step will display
    // for the annual plan. On failure (e.g. `Plan ANNUAL is not
    // seeded`) we flag the annual option as unavailable so the picker
    // hides that card instead of quoting the monthly price as annual
    // and dead-ending Continue at "resource not found".
    let cancelled = false;

    billingService
      .createCheckoutIntent({
        disclaimerVersion: DISCLAIMER_VERSION,
        planKind: "ANNUAL",
        fileName: preview?.filename,
      })
      .then((annual) => {
        if (cancelled) return;
        setAnnualIntent(annual);
      })
      .catch((err) => {
        if (cancelled) return;
        setAnnualUnavailable(true);
        logger.captureError(err, "checkout.annual_intent_prefetch");
      });

    return () => {
      cancelled = true;
      setIntent(null);
      setAnnualIntent(null);
      setAnnualUnavailable(false);
      setError(null);
      setPayFailed(false);
      setRetryKey(0);
    };
    // Intentionally depend only on `isOpen` — the mutation identity
    // would otherwise double-fire the intent request.
  }, [isOpen]);

  const handleIframeSuccess = async (message?: {
    order?: { subscription_id?: string; status?: string };
    status?: string;
  }) => {
    // Check if the callback payload indicates a declined or failed order
    const subscriptionId = message?.order?.subscription_id;
    const orderStatus = (
      message?.order?.status ??
      message?.status ??
      ""
    ).toLowerCase();

    if (
      orderStatus === "declined" ||
      orderStatus === "failed" ||
      orderStatus === "rejected" ||
      orderStatus === "error"
    ) {
      logger.event(EVENTS.CHECKOUT_IFRAME_DECLINED, "warning", { orderStatus });
      handleIframeFail();

      return;
    }

    logger.event(EVENTS.CHECKOUT_IFRAME_SUCCESS, "info", {
      hasSubscriptionId: Boolean(subscriptionId),
      orderStatus,
    });

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
        logger.event(EVENTS.CHECKOUT_ENTITLEMENT_MISMATCH, "warning", {
          subscriptionId,
        });
        handleIframeFail();

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

      logger.event(EVENTS.CHECKOUT_ENTITLEMENT_CONFIRMED, "info");
      toast.success({
        title: "Payment received",
        description: "Your access is unlocked.",
      });
      setStep("success");
    } catch (err) {
      logger.captureError(err, "checkout.subscription_sync", {
        subscriptionId,
      });
      handleIframeFail();
    }
  };

  const handleIframeFail = () => {
    logger.event(EVENTS.CHECKOUT_IFRAME_DECLINED, "warning");
    setPayFailed(true);
    toast.error({
      title: "Payment declined",
      description: "Your card wasn't charged. Try another card to retry.",
    });
  };

  const handleRetry = () => {
    logger.event(EVENTS.CHECKOUT_RETRY_START, "info");
    // Fresh CheckoutIntent for the retry — Solidgate marks the previous
    // paymentIntent terminal after a decline, so re-mounting the iframe
    // against the same intent just re-renders the "Payment declined"
    // state. Bump retryKey to force a full PaymentForm remount, then
    // load a new intent and drop the failed flag once it lands.
    setRetryLoading(true);
    setPayFailed(false);
    createIntent.mutate(
      {
        disclaimerVersion: DISCLAIMER_VERSION,
        fileName: preview?.filename,
      },
      {
        onSuccess: (fresh) => {
          setIntent(fresh);
          setRetryKey((k) => k + 1);
          setRetryLoading(false);
          logger.event(EVENTS.CHECKOUT_RETRY_INTENT_OK, "info");
        },
        onError: (err) => {
          logger.captureError(err, "checkout.retry_intent");
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

  // Continue-from-plan-step handler. Trial reuses the intent already
  // fetched on modal open. Annual re-fetches the intent with
  // `planKind: "ANNUAL"` so the backend swaps to the annual price ID
  // (Solidgate product b1ed4002-ab3f-4f56-b822-1489c538c6c7) and
  // returns the annual amounts before we mount the payment iframe.
  const [continueLoading, setContinueLoading] = useState(false);
  const handleContinue = () => {
    // Milestone — user committed to a plan and clicked Continue. Slice
    // paywall funnel by which plan users pick + whether the annual
    // intent had already resolved by the time they reached Continue
    // (perf signal for the parallel prefetch at PaywallModal open).
    logger.event(EVENTS.PAYWALL_PLAN_STEP_CONTINUE, "info", {
      selectedPlan,
      annualPrefetchReady: Boolean(annualIntent),
      annualUnavailable,
    });

    if (selectedPlan === "monthly") {
      logger.event(EVENTS.PAYWALL_PAY_STEP_MOUNTED, "info", {
        plan: "monthly",
        via: "direct",
      });
      setStep("pay");

      return;
    }

    // Reuse the parallel-fetched annual intent when it's already
    // landed — same paymentIntent the picker priced against. Only
    // re-fetch when it's still pending or failed.
    if (annualIntent) {
      setIntent(annualIntent);
      logger.event(EVENTS.PAYWALL_PAY_STEP_MOUNTED, "info", {
        plan: "annual",
        via: "prefetch",
      });
      setStep("pay");

      return;
    }

    setContinueLoading(true);
    createIntent.mutate(
      {
        disclaimerVersion: DISCLAIMER_VERSION,
        planKind: "ANNUAL",
        fileName: preview?.filename,
      },
      {
        onSuccess: (fresh) => {
          setIntent(fresh);
          setAnnualIntent(fresh);
          logger.event(EVENTS.PAYWALL_PAY_STEP_MOUNTED, "info", {
            plan: "annual",
            via: "fallback_fetch",
          });
          setStep("pay");
          setContinueLoading(false);
        },
        onError: (err) => {
          const apiErr = err as { statusCode?: number; message?: string };

          logger.event(EVENTS.CHECKOUT_INTENT_ERROR, "warning", {
            statusCode: apiErr?.statusCode,
            errorMessage: apiErr?.message,
            plan: "annual",
            path: "handleContinue",
          });
          logger.captureError(err, "checkout.annual_intent", {
            statusCode: apiErr?.statusCode,
            errorMessage: apiErr?.message,
          });
          setContinueLoading(false);
          toast.error({
            title: "Couldn't start annual checkout",
            description:
              err instanceof Error
                ? err.message
                : "Please try again in a moment.",
          });
        },
      },
    );
  };

  return (
    <Modal.Backdrop
      isDismissable={false}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Success step: `onPaymentSuccess` already fired on mount and
          // resolved the bus. `onClose` (from usePaywall) is now
          // idempotent — it detects the bus was already settled and
          // skips the cancel path, so we can call it here safely for
          // both branches. Only the analytics event differs.
          if (step !== "success") {
            logger.event(EVENTS.PAYWALL_MODAL_CLOSED_MANUAL, "info", {
              step,
              hadError: Boolean(error),
              payFailed,
            });
          }
          onClose();
        }
      }}
    >
      <Modal.Container className="items-start justify-center p-4 sm:items-center">
        <Modal.Dialog
          className={
            step === "success"
              ? "max-h-[calc(100dvh-32px)] w-[min(460px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] dark:bg-content1"
              : step === "plan"
                ? hidePreview
                  ? "max-h-[calc(100dvh-32px)] w-[min(760px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] dark:bg-content1"
                  : "max-h-[calc(100dvh-32px)] w-[60vw] min-w-[min(900px,calc(100vw-32px))] max-w-[60vw] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] dark:bg-content1"
                : "max-h-[calc(100dvh-32px)] w-[min(920px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:!max-w-[920px] dark:bg-content1"
          }
        >
          {/* CloseTrigger visible on all steps. On SuccessStep the bus
              was already resolved via `onPaymentSuccess` at mount time,
              so closing here is safe — `usePaywall.close` no-ops the
              cancel branch when the resolver ref is already cleared. */}
          <Modal.CloseTrigger />
          {error ? (
            <ErrorState error={error} />
          ) : !intent ? (
            <LoadingState />
          ) : step === "plan" ? (
            <PlanStep
              annualIntent={annualIntent}
              annualUnavailable={annualUnavailable}
              continueLoading={continueLoading}
              hidePreview={hidePreview}
              intent={intent}
              preview={preview}
              selectedPlan={selectedPlan}
              onContinue={handleContinue}
              onSelectPlan={setSelectedPlan}
            />
          ) : step === "pay" ? (
            <PayStep
              intent={intent}
              payFailed={payFailed}
              preview={preview}
              retryKey={retryKey}
              retryLoading={retryLoading}
              selectedPlan={selectedPlan}
              onFail={handleIframeFail}
              onRetry={handleRetry}
              onSuccess={handleIframeSuccess}
            />
          ) : (
            <SuccessStep
              intent={intent}
              selectedPlan={selectedPlan}
              onClose={onClose}
              onFireQueuedAction={finish}
            />
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
  annualIntent,
  annualUnavailable,
  preview,
  hidePreview,
  selectedPlan,
  onSelectPlan,
  onContinue,
  continueLoading,
}: {
  intent: CheckoutIntent;
  annualIntent: CheckoutIntent | null;
  annualUnavailable: boolean;
  preview: PaywallPreview | null;
  hidePreview: boolean;
  selectedPlan: PlanId;
  onSelectPlan: (id: PlanId) => void;
  onContinue: () => void;
  continueLoading: boolean;
}) {
  // Annual is offered only when the backend actually has an ANNUAL
  // plan seeded. Signal: either the standalone ANNUAL intent resolved
  // OR the primary intent's alternatePlans includes an ANNUAL row.
  // When the pre-fetch already 404'd (annualUnavailable=true) we hide
  // regardless — no point offering a plan the checkout will reject.
  const annualInAlternates = Boolean(
    intent.alternatePlans?.some((row) => row.planKind === "ANNUAL"),
  );
  const annualAvailable =
    !annualUnavailable && (Boolean(annualIntent) || annualInAlternates);

  // Snap the picker back to monthly if the user had annual selected
  // but the backend just told us it isn't available. Runs at most once
  // per unavailability transition.
  useEffect(() => {
    if (!annualAvailable && selectedPlan === "annual") {
      onSelectPlan("monthly");
    }
  }, [annualAvailable, selectedPlan, onSelectPlan]);

  // Monthly numbers come from the primary intent. Annual numbers
  // prefer the standalone ANNUAL intent (fetched in parallel on modal
  // open) so the per-month figure on the picker matches exactly what
  // the payment step will show. When the ANNUAL intent hasn't landed
  // yet we fall back to `intent.alternatePlans[ANNUAL]` — never bake
  // USD strings because the same modal renders EUR / PKR / INR /
  // etc. once local pricing kicks in.
  const monthly = pickPlan(intent, "TRIAL_MONTHLY");
  const annual = annualIntent
    ? {
        amountTodayMinor: annualIntent.amountTodayMinor,
        amountRenewMinor: annualIntent.amountRenewMinor,
        currency: annualIntent.currency,
      }
    : pickPlan(intent, "ANNUAL");
  const fullAccessPrice = formatMinor(
    monthly.amountTodayMinor,
    monthly.currency,
  );
  const annualPrice = formatMinor(
    Math.round(annual.amountRenewMinor / 12),
    annual.currency,
  );
  // Full annual figure the card shows underneath the per-month price
  // ("Billed as $300.00 / year"). Same source as the payment step's
  // order-summary card, so both screens agree.
  const annualFullPrice = formatMinor(annual.amountRenewMinor, annual.currency);
  const todayDisplay =
    selectedPlan === "annual"
      ? formatMinor(annual.amountTodayMinor, annual.currency)
      : formatMinor(monthly.amountTodayMinor, monthly.currency);

  const continueDisabled = continueLoading;
  const readyHeading = (() => {
    if (!preview) return "Your PDF is ready.";
    const ext = (
      preview.targetExt ||
      preview.sourceExt ||
      preview.filename?.split(".").pop() ||
      ""
    )
      .toLowerCase()
      .trim();

    if (["jpg", "jpeg"].includes(ext)) return "Your JPG is ready.";
    if (ext === "png") return "Your PNG is ready.";
    if (["doc", "docx", "word"].includes(ext))
      return "Your Word document is ready.";
    if (["xls", "xlsx", "excel"].includes(ext))
      return "Your Excel document is ready.";
    if (["ppt", "pptx", "powerpoint"].includes(ext))
      return "Your PowerPoint presentation is ready.";
    if (ext === "txt") return "Your Text document is ready.";

    return "Your PDF is ready.";
  })();

  return (
    <div className="flex flex-col">
      {/* Header row — title (left) + Continue (right) */}
      <div className="flex flex-col gap-3 border-b border-[#ececec] p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="pv-heading text-[20px] font-semibold leading-tight text-[#1a1c21] sm:text-[24px]">
            {readyHeading}
          </h2>
          <p className="text-[13px] text-[#6c6c6c]">
            Cancel anytime · Secure checkout · Instant access
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <button
            className="group inline-flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--pv-brand-red,#f12c23)] px-6 text-[14px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(241,44,35,0.6)] transition-all hover:-translate-y-px hover:bg-[#d8241c] hover:shadow-[0_14px_28px_-8px_rgba(241,44,35,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-red,#f12c23)] disabled:cursor-not-allowed disabled:bg-[#c7c7c7] disabled:shadow-none disabled:hover:translate-y-0 active:translate-y-px"
            disabled={continueDisabled}
            type="button"
            onClick={onContinue}
          >
            {continueLoading ? "Preparing…" : "Continue"}
            {continueLoading ? null : (
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Body — two columns, or plan-picker only when the caller
          suppresses the preview (billing settings entry point). */}
      {hidePreview ? (
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <PlanCards
            annualAvailable={annualAvailable}
            annualFullPrice={annualFullPrice}
            annualPrice={annualPrice}
            fullAccessPrice={fullAccessPrice}
            selectedPlan={selectedPlan}
            onSelectPlan={onSelectPlan}
          />

          <AcceptedCards />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left — preview column (or fallback content) */}
          <div
            className="flex flex-col justify-center gap-5 p-6 md:p-8"
            style={{ backgroundColor: CREAM }}
          >
            <BrandLogo />

            {preview ? (
              <>
                <span className="flex w-fit items-center gap-2 rounded-full bg-[#f12c23] px-4 py-1.5 text-[13px] font-semibold text-white">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white">
                    <HugeiconsIcon
                      color="#22c55e"
                      icon={Tick01Icon}
                      size={15}
                      strokeWidth={3}
                    />
                  </span>
                  Your document is ready to download
                </span>
                <PreviewFileCard preview={preview} />
              </>
            ) : (
              <>
                <span className="flex w-fit items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#111827] shadow-sm ring-1 ring-default-200">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white">
                    <HugeiconsIcon
                      color="#22c55e"
                      icon={Tick01Icon}
                      size={15}
                      strokeWidth={3}
                    />
                  </span>
                  Your document is ready to download
                </span>
                <GenericPreviewCard />
              </>
            )}
          </div>

          {/* Right — plan cards column */}
          <div className="flex flex-col gap-4 p-6 md:p-8">
            <PlanCards
              annualAvailable={annualAvailable}
              annualFullPrice={annualFullPrice}
              annualPrice={annualPrice}
              fullAccessPrice={fullAccessPrice}
              selectedPlan={selectedPlan}
              onSelectPlan={onSelectPlan}
            />

            <AcceptedCards />
          </div>
        </div>
      )}

      {/* Full-width centered disclaimer footer — spans both columns.
          Wording follows the Solidgate compliance template: state the
          subscription frequency, exact recurring price, source card,
          and cancellation paths. */}
      <div className="border-t border-[#ececec] px-6 py-5 md:px-8">
        {selectedPlan === "monthly" ? (
          <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-[#8a8a8a]">
            You are enrolling in a monthly subscription to pdfvault.ai.
            You&apos;ll be charged {fullAccessPrice} today for a 7-day trial,
            then {formatMinor(monthly.amountRenewMinor, monthly.currency)} per
            month until you cancel. Payments will be charged from the card you
            specified below. To cancel, visit your{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="/dashboard/settings/billing"
            >
              account settings
            </a>
            , see our{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="/subscription-terms"
            >
              Subscription Terms
            </a>
            , or email{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>
            .
          </p>
        ) : (
          <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-[#8a8a8a]">
            You are enrolling in an annual subscription to pdfvault.ai. You
            agree to be billed{" "}
            {formatMinor(annual.amountRenewMinor, annual.currency)} per year
            until you cancel. Payments will be charged from the card you
            specified below. To cancel, visit your{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="/dashboard/settings/billing"
            >
              account settings
            </a>
            , see our{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="/subscription-terms"
            >
              Subscription Terms
            </a>
            , or email{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>
            .
          </p>
        )}

        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] leading-relaxed text-[#8a8a8a]">
          Charged in {intent.currency}. See our{" "}
          <a
            className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
            href="/terms-and-conditions"
          >
            Terms and Conditions
          </a>{" "}
          for details. We provide refunds in accordance with our{" "}
          <a
            className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
            href="/refund-policy"
          >
            Refund Policy
          </a>
          .
        </p>
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
  selectedPlan,
  preview,
}: {
  intent: CheckoutIntent;
  onSuccess: (message?: { order?: { subscription_id?: string } }) => void;
  onFail: () => void;
  payFailed: boolean;
  retryKey: number;
  retryLoading: boolean;
  onRetry: () => void;
  selectedPlan: PlanId;
  preview: PaywallPreview | null;
}) {
  const todayDisplay = formatMinor(intent.amountTodayMinor, intent.currency);
  const renewDisplay = formatMinor(intent.amountRenewMinor, intent.currency);
  const renewMonthlyEquivalent = formatMinor(
    selectedPlan === "annual"
      ? Math.round(intent.amountRenewMinor / 12)
      : intent.amountRenewMinor,
    intent.currency,
  );

  // Solidgate renders Apple Pay + Google Pay into detached container
  // elements — the SDK requires the refs to exist BEFORE `<PaymentForm>`
  // mounts. On non-Safari browsers Apple Pay silently no-ops (SDK
  // hides the container); on non-supporting Android/iOS Google Pay
  // does the same. Both wallets also require merchant-side dashboard
  // enablement + domain verification (Apple Pay only).
  const applePayContainerRef = useRef<HTMLDivElement>(null);
  const googlePayContainerRef = useRef<HTMLDivElement>(null);
  // Wallet-button loading state (2026-09-06 QA). Solidgate injects the
  // real Apple Pay / Google Pay buttons a beat after `<PaymentForm>`
  // mounts, so the containers were previously blank for that gap
  // (`empty:hidden` collapsed them). Track when each container gains
  // children via MutationObserver and swap a skeleton in until then.
  // On browsers where the wallet is unsupported the SDK never
  // populates the container — `walletTimedOut` clears the skeletons
  // after 4 s so we don't leave a permanent placeholder.
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [walletTimedOut, setWalletTimedOut] = useState(false);

  useEffect(() => {
    const applePayEl = applePayContainerRef.current;
    const googlePayEl = googlePayContainerRef.current;

    if (!applePayEl || !googlePayEl) return;

    const applyObserver = new MutationObserver(() => {
      if (applePayEl.childNodes.length > 0) setApplePayReady(true);
    });
    const googleObserver = new MutationObserver(() => {
      if (googlePayEl.childNodes.length > 0) setGooglePayReady(true);
    });

    applyObserver.observe(applePayEl, { childList: true });
    googleObserver.observe(googlePayEl, { childList: true });

    const timeout = window.setTimeout(() => setWalletTimedOut(true), 4000);

    return () => {
      applyObserver.disconnect();
      googleObserver.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);
  // 2026-09-03 (PM): the Solidgate card form starts COLLAPSED behind
  // a grey "Pay with card" button. Clicking expands the iframe below.
  // `<PaymentForm>` itself stays mounted whether expanded or not
  // (it's what mounts Apple Pay / Google Pay into the detached refs
  // above), so we hide the card iframe wrapper via `hidden` rather
  // than conditionally rendering the whole PaymentForm.
  const [cardExpanded, setCardExpanded] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Left column — payment (white) ── */}
      <div className="flex flex-col gap-0">
        {/* Total due today header — matches the right-column order
            summary so both instances of "Total due today" read at
            the same weight and size (2026-09-03 PM ask). */}
        <div className="flex items-baseline justify-between border-b border-[#ececec] px-6 py-5 md:px-8">
          <span className="pv-heading text-[16px] font-extrabold text-[#1a1c21]">
            Total due today
          </span>
          <span className="pv-heading text-[22px] font-extrabold text-[#1a1c21]">
            {todayDisplay}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-6 md:p-8">
          {/* Express checkout label */}
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[#1a1c21]">
            Express checkout
          </p>

          {/* Real SDK wallet buttons + card form. Mounted immediately on
              PayStep open so the user sees exactly one Apple Pay / Google
              Pay button (the SDK-rendered one), never a placeholder that
              silently swaps for a real button after a click. Also gets the
              SDK load happening as soon as Continue is pressed, so the
              wallet buttons are ready when the user reaches them. */}
          <div className="flex flex-col gap-4">
            {/* Apple Pay — SDK injects here; hidden until mounted */}
            <div className="relative">
              {!applePayReady && !walletTimedOut ? (
                <WalletButtonSkeleton />
              ) : null}
              <div
                ref={applePayContainerRef}
                className="empty:hidden h-[42px] overflow-hidden rounded-xl [&>*]:!h-[42px] [&>*]:!max-h-[42px] [&>*]:!w-full [&_iframe]:!h-[42px] [&_iframe]:!max-h-[42px] [&_iframe]:!w-full [&_iframe]:!rounded-xl"
              />
            </div>
            {/* Google Pay — SDK injects here; hidden until mounted.
                No shape / height overrides — Google's brand guidelines
                require the CreateButton API's native pill radius and
                its own height range (40–60px). The `w-full` passthrough
                lets Solidgate's SDK size the button to the container
                width via `buttonSizeMode: "fill"`. */}
            <div className="relative">
              {!googlePayReady && !walletTimedOut ? (
                <WalletButtonSkeleton />
              ) : null}
              <div
                ref={googlePayContainerRef}
                className="empty:hidden w-full [&>*]:!w-full [&_iframe]:!w-full"
              />
            </div>
            {/* Card section header — grey collapse toggle. Shows the
                supported card brands so users know their card will
                work before expanding (parity with PDF Guru). */}
            <PayWithCardHeader
              expanded={cardExpanded}
              onToggle={() => setCardExpanded((v) => !v)}
            />
            {/* Card form. `key` bumps on retry so the Solidgate iframe fully
                remounts — declined intents are terminal on Solidgate's side
                and won't accept a second attempt on the same key.

                Wrapper stays mounted whether the section is expanded
                or not — `hidden` just toggles visibility. Unmounting
                <PaymentForm> here would tear down the Apple Pay /
                Google Pay containers along with the card iframe. */}
            <div
              className="rounded-xl"
              hidden={!cardExpanded}
              id="paywall-card-form"
            >
              {/*
                Key on `paymentIntent` in addition to `retryKey` so a
                plan switch (monthly → annual) forces a full remount
                of the Solidgate SDK. Without this, the SDK caches
                the wallet-button state against the original intent's
                paymentIntent id and silently refuses to re-inject
                Apple Pay / Google Pay for the new annual amount —
                users see the wallets on monthly but a blank space
                on annual (QA 2026-09-06). `retryKey` stays in the
                composite so an in-plan decline+retry still cleanly
                remounts the iframe.
              */}
              <StablePaymentForm
                applePayContainerRef={applePayContainerRef}
                googlePayContainerRef={googlePayContainerRef}
                merchant={intent.merchant}
                paymentIntent={intent.paymentIntent}
                retryKey={retryKey}
                signature={intent.signature}
                onFail={onFail}
                onSuccess={onSuccess}
              />
            </div>
          </div>

          {payFailed ? (
            <div
              aria-live="polite"
              className="flex flex-col gap-2.5 rounded-xl border border-danger-200 bg-danger-50 p-5 text-[14px] text-danger-800 sm:p-6 sm:text-[15px] dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200"
            >
              <p className="text-[15px] font-semibold leading-snug sm:text-[17px]">
                Your card was declined and hasn&apos;t been charged.
              </p>
              <p className="leading-relaxed">
                Try another card or contact your bank. You can re-enter details
                below.
              </p>
              <button
                className="mt-2 inline-flex h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--pv-brand-red,#f12c23)] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#d8241c] disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:text-[16px]"
                disabled={retryLoading}
                type="button"
                onClick={onRetry}
              >
                {retryLoading ? "Preparing…" : "Try another card"}
              </button>
            </div>
          ) : null}

          {/* Plan features */}
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#1a1c21]">
              {selectedPlan === "annual" ? "Annual Access" : "7-Day Access"}
            </p>
            <ul className="flex flex-col gap-2.5 text-[13px] text-[#1a1c21]">
              <Feature>Unlimited downloads</Feature>
              <Feature>Unlimited edits</Feature>
              <Feature>Convert to any format</Feature>
              <Feature>Password-protect your documents</Feature>
            </ul>
          </div>

          {/* Legal small-print */}
          <p className="text-[11px] leading-relaxed text-[#8a8a8a]">
            By continuing you agree to be charged{" "}
            {selectedPlan === "annual"
              ? `${todayDisplay} every 365 days`
              : `${todayDisplay} today for a 7-day trial, then ${renewDisplay} per month`}{" "}
            unless cancelled. See our{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="/terms-and-conditions"
            >
              Subscription
            </a>{" "}
            &amp;{" "}
            <a
              className="text-[#8a8a8a] underline underline-offset-2 hover:text-[#6c6c6c]"
              href="/refund-policy"
            >
              Refund
            </a>{" "}
            policies.
          </p>

          {process.env.NODE_ENV !== "production" ? (
            <p className="rounded-md bg-warning-50 px-2 py-1.5 text-[11px] text-warning-800 dark:bg-warning-900/30 dark:text-warning-200">
              <strong>Sandbox test card:</strong> 4067 4299 7471 9265 · any
              future expiry · any CVV
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Right column — document preview (cream) ── */}
      <div
        className="flex flex-col gap-3 p-6 md:p-8"
        style={{ backgroundColor: CREAM }}
      >
        {/* "Your document is ready!" pill — mirrors the PDF Guru
            payment-details screen so the user sees a positive
            reinforcement message above the invoice preview. */}
        <div className="flex items-center gap-2 rounded-xl bg-[#e8f5e9] px-4 py-3 text-[14px] font-semibold text-[#1a4d1e]">
          <span
            aria-hidden
            className="inline-flex size-5 items-center justify-center rounded-full bg-[#2e7d32] text-white"
          >
            <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={3} />
          </span>
          Your document is ready!
        </div>
        {preview ? (
          <PreviewFileCard preview={preview} />
        ) : (
          <GenericPreviewCard />
        )}

        {/* Order summary card — flattened per 2026-09-03 PM ask. Only
            the "TOTAL DUE TODAY / <price>" line renders now; the plan
            title, "Due today" / "Billed annually" subtitle, and
            "Renews yearly / monthly" row are all dropped. The
            auto-renew wording still lives in the legal small-print
            below the form. */}
        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="pv-heading text-[16px] font-extrabold text-[#1a1c21]">
              Total due today
            </p>
            <p className="pv-heading text-[22px] font-extrabold text-[#1a1c21]">
              {todayDisplay}
            </p>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#6c6c6c]">
          <span aria-hidden>🔒</span>
          Card details never touch our servers. Payments run through a
          PCI-compliant partner.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Success
// ─────────────────────────────────────────────────────────────
function SuccessStep({
  intent,
  selectedPlan,
  onClose,
  onFireQueuedAction,
}: {
  intent: CheckoutIntent;
  selectedPlan: PlanId;
  onClose: () => void;
  onFireQueuedAction: () => void;
}) {
  const today = formatMinor(intent.amountTodayMinor, intent.currency);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  // Fire the queued gated action (encrypt / decrypt / compress /
  // convert / etc.) as soon as the success step mounts, WITHOUT closing
  // the modal. QA 2026-09-06 (updated): user asked that the receipt-
  // download modal stay open until they click X or Continue, but the
  // queued download still needs to trigger immediately — no manual
  // gate. `onFireQueuedAction` (= usePaywall's `onPaymentSuccess`)
  // resolves the bus + runs pending; it deliberately doesn't touch
  // modal open state.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onFireQueuedAction();
  }, [onFireQueuedAction]);

  // Fire Google Ads "Trial Start Signal" conversion on payment success.
  useEffect(() => {
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: "AW-18226423046/31lDCOKzxeccEIbKhPND",
        transaction_id: "",
      });
    }
  }, []);

  // Push a dedicated `trial_started` event to the GTM dataLayer so tags
  // configured in the container can trigger on a purpose-built event
  // (with amount, currency, orderId, and plan) instead of piggy-backing
  // on the raw gtag conversion above. This is the marketing team's
  // preferred hook for post-payment tracking — see 2026-08-31 request
  // for "post-payment URL" (there isn't one; the flow is modal-only).
  useEffect(() => {
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    window.dataLayer.push({
      currency: intent.currency,
      event: "trial_started",
      orderId: intent.orderId,
      plan: selectedPlan,
      value: intent.amountTodayMinor / 100,
    });
  }, [intent.amountTodayMinor, intent.currency, intent.orderId, selectedPlan]);

  // Download the receipt inline. Synthesizes an `Invoice` from the
  // CheckoutIntent so we don't need to wait for the backend to
  // materialize the real invoice row (that arrives on the next
  // Solidgate webhook, typically seconds after the payment settles).
  // Once the row lands, the /dashboard/settings/billing table shows
  // the same receipt via the existing InvoicesTable flow.
  const handleDownloadReceipt = async () => {
    if (isGeneratingReceipt) return;
    setIsGeneratingReceipt(true);
    try {
      const invoice: Invoice = {
        id: intent.orderId,
        amountMinor: intent.amountTodayMinor,
        currency: intent.currency,
        status: "APPROVED",
        type: intent.amountTodayMinor === 0 ? "TRIAL" : "RECURRING",
        invoiceNumber: null,
        invoiceUrl: null,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const bytes = await generateReceiptPdf(invoice, {
        customerEmail: null,
        planName: `Full Access · ${selectedPlan === "annual" ? "Annual" : "Monthly"}`,
      });
      const blob = new Blob([bytes as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = receiptFileName(invoice);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      logger.event(EVENTS.PAYWALL_RECEIPT_DOWNLOAD_OK, "info", {
        orderId: intent.orderId,
        selectedPlan,
        currency: intent.currency,
      });
    } catch (err) {
      logger.event(EVENTS.PAYWALL_RECEIPT_DOWNLOAD_ERROR, "warning", {
        orderId: intent.orderId,
        selectedPlan,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      logger.captureError(err, "paywall.receipt_download");
      toast.error({
        title: "Couldn't download receipt",
        description:
          err instanceof Error
            ? err.message
            : "Try again from Settings → Billing.",
      });
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

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
          Your plan is active. You now have full access to every PDFVault tool.
        </p>
      </div>

      <div
        className="w-full rounded-xl p-4 text-left text-[13px]"
        style={{ backgroundColor: CREAM }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[#5c5c5c]">Plan</span>
          <span className="font-semibold text-[#1a1c21]">
            {selectedPlan === "annual" ? "Annual plan" : "7-day trial"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[#5c5c5c]">Charged today</span>
          <span className="font-semibold text-[#1a1c21]">{today}</span>
        </div>
      </div>

      <button
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--pv-brand-red,#f12c23)] text-[15px] font-semibold text-white shadow-[0_10px_20px_-8px_rgba(241,44,35,0.55)] transition-colors hover:bg-[#d8241c]"
        type="button"
        onClick={onClose}
      >
        Continue
        <span aria-hidden>→</span>
      </button>
      <button
        className="flex h-[48px] w-full cursor-pointer items-center justify-center rounded-2xl border border-[#ececec] text-[14px] font-medium text-[#1a1c21] transition-colors hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isGeneratingReceipt}
        type="button"
        onClick={() => void handleDownloadReceipt()}
      >
        {isGeneratingReceipt ? "Preparing receipt…" : "Download receipt"}
      </button>
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
      className="h-[44px] w-auto object-contain"
      height={44}
      src="/landing/logo-with-text.png"
      width={176}
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
  const { filename, sourceExt, targetExt, previewObjectUrl } = preview;
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
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_4px_16px_-8px_rgba(0,0,0,0.15)]">
      {/* File type badge header */}
      <div className="flex items-center justify-end bg-[#f7f7f9] px-4 py-2.5">
        <span
          className="inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[10px] font-bold text-white"
          style={{ backgroundColor: targetBadge }}
        >
          {targetExt.toUpperCase()}
        </span>
      </div>

      {/* Document preview — real PDF iframe when available, blurred mock otherwise */}
      {previewObjectUrl ? (
        <div className="h-[260px] w-full overflow-hidden">
          <iframe
            className="h-full w-full border-none"
            src={`${previewObjectUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            style={{ pointerEvents: "none" }}
            title={filename}
          />
        </div>
      ) : (
        <div className="relative p-4">
          <div
            aria-hidden
            className="pointer-events-none flex select-none flex-col gap-1.5"
            style={{ filter: "blur(3px)" }}
          >
            <div className="h-2 w-3/4 rounded bg-[#e5e5e5]" />
            <div className="h-2 w-full rounded bg-[#eaeaea]" />
            <div className="h-2 w-5/6 rounded bg-[#eaeaea]" />
            <div className="h-2 w-2/3 rounded bg-[#e5e5e5]" />
            <div className="mt-2 h-16 w-full rounded bg-[#f0f0f0]" />
            <div className="h-2 w-4/5 rounded bg-[#eaeaea]" />
            <div className="h-2 w-full rounded bg-[#eaeaea]" />
            <div className="h-2 w-3/5 rounded bg-[#e5e5e5]" />
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pv-brand-red,#f12c23)] text-white shadow-[0_10px_24px_-6px_rgba(241,44,35,0.55)] ring-4 ring-white">
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
        </div>
      )}

      {/* File-name + format transition */}
      <div className="flex items-center gap-2 border-t border-[#ececec] px-4 py-3">
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

/**
 * Blurred generic document card used when the paywall opens without a
 * concrete `PaywallPreview` (billing settings → Add billing method, or
 * the axios interceptor gate). Same visual language as PreviewFileCard
 * so the left column always shows a "your file is ready" moment
 * regardless of entry point.
 */
function GenericPreviewCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_4px_16px_-8px_rgba(0,0,0,0.15)]">
      {/* File type badge header */}
      <div className="flex items-center justify-end bg-[#f7f7f9] px-4 py-2.5">
        <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-[#e11d48] px-2 text-[10px] font-bold text-white">
          PDF
        </span>
      </div>

      {/* Blurred mock content */}
      <div className="relative p-4">
        <div
          aria-hidden
          className="pointer-events-none flex select-none flex-col gap-1.5"
          style={{ filter: "blur(3px)" }}
        >
          <div className="h-2 w-3/4 rounded bg-[#e5e5e5]" />
          <div className="h-2 w-full rounded bg-[#eaeaea]" />
          <div className="h-2 w-5/6 rounded bg-[#eaeaea]" />
          <div className="h-2 w-2/3 rounded bg-[#e5e5e5]" />
          <div className="mt-2 h-20 w-full rounded bg-[#f0f0f0]" />
          <div className="h-2 w-4/5 rounded bg-[#eaeaea]" />
          <div className="h-2 w-full rounded bg-[#eaeaea]" />
          <div className="h-2 w-3/5 rounded bg-[#e5e5e5]" />
          <div className="h-2 w-5/6 rounded bg-[#eaeaea]" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pv-brand-red,#f12c23)] text-white shadow-[0_10px_24px_-6px_rgba(241,44,35,0.55)] ring-4 ring-white">
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
  "Edit text and images in PDF files",
  "Organize and reorder PDF pages",
  "Protect PDF with password",
] as const;

function PlanCards({
  selectedPlan,
  onSelectPlan,
  fullAccessPrice,
  annualPrice,
  annualFullPrice,
  annualAvailable,
}: {
  selectedPlan: PlanId;
  onSelectPlan: (id: PlanId) => void;
  fullAccessPrice: string;
  annualPrice: string;
  annualFullPrice: string;
  annualAvailable: boolean;
}) {
  const plans = [
    {
      id: "monthly" as PlanId,
      title: "7-day trial",
      price: fullAccessPrice,
      priceSuffix: undefined as string | undefined,
      note: "",
      badge: "Most popular",
    },
    ...(annualAvailable
      ? [
          {
            id: "annual" as PlanId,
            title: "Annual Plan",
            price: annualPrice,
            priceSuffix: "/ month",
            // 2026-09-03 (PM): drop the "Billed as X / year" note from
            // the Annual Plan card. The renew total already lives on the
            // pay-step's order-summary card, so it's redundant here.
            note: "",
            badge: undefined as string | undefined,
          },
        ]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      {plans.map((plan) => {
        const selected = plan.id === selectedPlan;

        return (
          <button
            key={plan.id}
            className={`w-full overflow-hidden rounded-2xl border bg-white text-left transition-all ${
              selected
                ? "border-2 border-[var(--pv-brand-red,#f12c23)] shadow-[0_10px_28px_-14px_rgba(241,44,35,0.3)]"
                : "border border-[#e5e7eb] hover:border-[#c7c7c7]"
            }`}
            type="button"
            onClick={() => onSelectPlan(plan.id)}
          >
            {/* "Most popular" full-width banner inside the card */}
            {plan.badge ? (
              <div className="w-full bg-gradient-to-r from-[#ffcc7a] to-[#fdb45e] py-2 text-center text-[12px] font-semibold text-[#7a4d0f]">
                🚀 {plan.badge}
              </div>
            ) : null}

            {/* Radio + title + price */}
            <div className="flex items-center gap-4 px-5 py-4">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected
                    ? "border-[var(--pv-brand-red,#f12c23)] bg-[var(--pv-brand-red,#f12c23)]"
                    : "border-[#d1d5db]"
                }`}
              >
                {selected ? (
                  <span className="block h-2 w-2 rounded-full bg-white" />
                ) : null}
              </span>
              <span className="pv-heading flex-1 text-[16px] font-semibold text-[#1a1c21]">
                {plan.title}
              </span>
              <span className="flex flex-col items-end leading-none">
                <span className="pv-heading text-[18px] font-bold text-[#1a1c21]">
                  {plan.price}
                </span>
                {plan.priceSuffix ? (
                  <span className="mt-1 text-[11px] text-[#6c6c6c]">
                    {plan.priceSuffix}
                  </span>
                ) : null}
                {plan.note ? (
                  <span className="mt-0.5 text-[10px] text-[#9a9a9a]">
                    {plan.note}
                  </span>
                ) : null}
              </span>
            </div>

            {/* Feature list — only for the selected plan */}
            {selected ? (
              <div className="border-t border-[#f5f5f5] px-5 pb-5 pt-3">
                <ul className="flex flex-col gap-2.5 text-[13px] text-[#1a1c21]">
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f5ec] text-[10px] font-bold text-[#0f9d58] ring-1 ring-[#0f9d58]/15">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Mastercard uses its two-circle brand mark (red + amber overlapping),
// which react-icons/si can't render because Simple Icons is monochrome
// (single-color silhouette). Inline SVG below matches the official
// Mastercard brand mark.
function MastercardMark() {
  return (
    <svg
      aria-hidden
      className="h-4 w-auto"
      viewBox="0 0 40 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Mastercard</title>
      <circle cx="15" cy="12" fill="#EB001B" r="7" />
      <circle cx="25" cy="12" fill="#F79E1B" r="7" />
      <path
        d="M20 6.5c1.72 1.29 2.83 3.35 2.83 5.5s-1.11 4.21-2.83 5.5c-1.72-1.29-2.83-3.35-2.83-5.5s1.11-4.21 2.83-5.5z"
        fill="#FF5F00"
      />
    </svg>
  );
}

// Maestro also uses a two-circle mark (blue + red). Simple Icons dropped
// its Maestro glyph, so inline the brand mark directly.
function MaestroMark() {
  return (
    <svg
      aria-hidden
      className="h-4 w-auto"
      viewBox="0 0 40 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Maestro</title>
      <circle cx="15" cy="12" fill="#0099DF" r="7" />
      <circle cx="25" cy="12" fill="#EB001B" r="7" />
      <path
        d="M20 6.5c1.72 1.29 2.83 3.35 2.83 5.5s-1.11 4.21-2.83 5.5c-1.72-1.29-2.83-3.35-2.83-5.5s1.11-4.21 2.83-5.5z"
        fill="#6C6BBD"
      />
    </svg>
  );
}

const ACCEPTED_CARD_BRANDS = [
  {
    Mark: () => (
      <SiVisa
        aria-hidden
        className="h-4 w-auto"
        style={{ color: "#1434CB" }}
        title="Visa"
      />
    ),
    label: "Visa",
  },
  { Mark: MastercardMark, label: "Mastercard" },
  { Mark: MaestroMark, label: "Maestro" },
  {
    Mark: () => (
      <SiAmericanexpress
        aria-hidden
        className="h-4 w-auto"
        style={{ color: "#006FCF" }}
        title="American Express"
      />
    ),
    label: "American Express",
  },
  {
    Mark: () => (
      <SiJcb
        aria-hidden
        className="h-4 w-auto"
        style={{ color: "#0E4C96" }}
        title="JCB"
      />
    ),
    label: "JCB",
  },
] as const;

/**
 * "Pay with card" section header — a grey collapse button that shows
 * the supported card brands on the right, matching PDF Guru's
 * express-checkout list. Click toggles the Solidgate card iframe
 * below it (the iframe stays mounted — parent `PayStep` uses the
 * `hidden` attribute so the wallet containers keep working).
 */
function PayWithCardHeader({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-controls="paywall-card-form"
      aria-expanded={expanded}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#575759] px-4 py-3 text-left transition-colors hover:bg-[#4a4a4c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-red,#f12c23)]"
      type="button"
      onClick={onToggle}
    >
      <span className="text-[15px] font-semibold text-white">
        Pay with card
      </span>
      <span className="flex items-center gap-1.5">
        {ACCEPTED_CARD_BRANDS.map(({ Mark, label }) => (
          <span
            key={label}
            aria-label={label}
            className="inline-flex h-6 min-w-[32px] items-center justify-center rounded-md border border-white/20 bg-white px-1.5"
            role="img"
          >
            <Mark />
          </span>
        ))}
      </span>
    </button>
  );
}

function AcceptedCards() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#6c6c6c]">
      <span>We accept</span>
      {ACCEPTED_CARD_BRANDS.map(({ Mark, label }) => (
        <span
          key={label}
          aria-label={label}
          className="inline-flex h-7 min-w-[38px] items-center justify-center rounded-md border border-[#ececec] bg-white px-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          role="img"
        >
          <Mark />
        </span>
      ))}
    </div>
  );
}

/**
 * Placeholder shown in the wallet slots while Solidgate's SDK injects
 * the real Apple Pay / Google Pay buttons. Sized to match the final
 * button height so the layout doesn't jump when the real button
 * arrives. Auto-hides once the container gains children (see the
 * MutationObserver in `PayStep`) or after the 4-s timeout for
 * unsupported browsers.
 */
function WalletButtonSkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#ececec]/60"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#c8c8c8] border-t-[var(--pv-brand-red,#f12c23)]" />
      <span className="text-[12px] font-medium text-[#5c5c5c]">
        Loading wallet…
      </span>
    </div>
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

// `formatMinor` now lives in `lib/shared/utils/currency.ts` and is
// imported at the top of this file so every currency display across
// the app renders from the same helper. The whole-app consistency
// requirement (user sees their PURCHASED currency everywhere) is
// enforced by every caller sourcing `currency` from backend data
// (CheckoutIntent / Invoice / Plan) rather than a hardcoded string.

/**
 * Pull pricing for a given plan kind out of the checkout-intent
 * response. The current plan's numbers live at the top level of the
 * intent; the others are in `alternatePlans`. Falls back to the
 * top-level intent when the requested kind isn't present in either
 * place (belt-and-braces so the modal never renders "undefined").
 */
function pickPlan(
  intent: CheckoutIntent,
  planKind: string,
): {
  amountTodayMinor: number;
  amountRenewMinor: number;
  currency: string;
} {
  const alt = intent.alternatePlans?.find((row) => row.planKind === planKind);

  if (alt) {
    return {
      amountTodayMinor: alt.amountTodayMinor,
      amountRenewMinor: alt.amountRenewMinor,
      currency: alt.currency,
    };
  }

  return {
    amountTodayMinor: intent.amountTodayMinor,
    amountRenewMinor: intent.amountRenewMinor,
    currency: intent.currency,
  };
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
