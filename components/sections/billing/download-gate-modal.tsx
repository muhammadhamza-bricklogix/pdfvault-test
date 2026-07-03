"use client";

import type { BillingPlan } from "@/lib/shared/constants/billing";

import { useAuth } from "@clerk/nextjs";
import { Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  BILLING_PLANS,
  DOWNLOAD_GATE_PLAN_IDS,
} from "@/lib/shared/constants/billing";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { PlanCard } from "./plan-card";

/**
 * Custom event contract. Any component that wants to trigger the paywall
 * dispatches `download-gate:open` on `window`; the provider mounts the modal.
 *
 * Usage:
 *   1. Mount <DownloadGateProvider /> once in the layout tree.
 *   2. Anywhere in the app:
 *        window.dispatchEvent(new CustomEvent("download-gate:open"));
 *   3. When entitlement flips to active, the provider will close itself.
 */
export const DOWNLOAD_GATE_OPEN_EVENT = "download-gate:open";

const KNOWN_ERRORS: Record<string, string> = {
  "billing-disabled":
    "Checkout is temporarily disabled. Please try again shortly.",
  "plan-not-provisioned":
    "This plan isn't wired up yet — our team is provisioning it.",
  "checkout-not-implemented":
    "Checkout is coming online soon. Thanks for your patience.",
  "unknown-plan": "Plan not found. Please refresh and try again.",
};

export function DownloadGateProvider() {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handler = () => setIsOpen(true);

    window.addEventListener(DOWNLOAD_GATE_OPEN_EVENT, handler);

    return () => window.removeEventListener(DOWNLOAD_GATE_OPEN_EVENT, handler);
  }, []);

  const plans = DOWNLOAD_GATE_PLAN_IDS.map((id) => BILLING_PLANS[id]).filter(
    (p): p is BillingPlan => Boolean(p),
  );

  const handleSelect = useCallback(
    async (plan: BillingPlan) => {
      if (!isSignedIn) {
        // Store intent and redirect to sign-in. After sign-in, user lands on
        // pricing and can reselect. Chargebee session isn't started until
        // we have a Clerk userId to bind the customer to.
        router.push(
          `${ROUTES.AUTH.SIGN_UP}?redirect_url=${encodeURIComponent(
            ROUTES.PUBLIC.PRICING,
          )}`,
        );
        setIsOpen(false);

        return;
      }

      setPendingPlanId(plan.id);

      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            returnUrl: `${window.location.origin}${window.location.pathname}`,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };

        if (res.ok && data.url) {
          window.location.href = data.url;

          return;
        }

        const message = data.error
          ? (KNOWN_ERRORS[data.error] ?? data.error)
          : "Something went wrong starting checkout.";

        toast.info({ title: "Checkout unavailable", description: message });
      } catch (error) {
        toast.error({
          title: "Checkout failed",
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setPendingPlanId(null);
      }
    },
    [isSignedIn, router],
  );

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[900px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Save & download your PDF</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-6">
              <p className="text-sm text-default-600 dark:text-default-400">
                Choose a plan to save your edits and download the file. Every
                plan renews automatically until you cancel — one-click cancel
                any time from your billing dashboard.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan, index) => (
                  <PlanCard
                    key={plan.id}
                    ctaLabel={
                      pendingPlanId === plan.id
                        ? "Redirecting…"
                        : plan.trialDays
                          ? "Start trial"
                          : "Choose plan"
                    }
                    featured={index === 1}
                    isLoading={pendingPlanId === plan.id}
                    plan={plan}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Helper for callers — lets them avoid touching the event name directly. */
export const openDownloadGate = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(DOWNLOAD_GATE_OPEN_EVENT));
};
