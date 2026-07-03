"use client";

import type { BillingPlan } from "@/lib/shared/constants/billing";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { billingService } from "@/lib/shared/api/services/billing.service";
import {
  BILLING_PLANS,
  PRICING_PAGE_PLAN_IDS,
} from "@/lib/shared/constants/billing";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { PlanCard } from "./plan-card";

const KNOWN_ERRORS: Record<string, string> = {
  "billing-disabled":
    "Checkout is temporarily disabled. Please try again shortly.",
  "billing-not-configured":
    "Checkout is coming online soon — our team is provisioning the billing provider.",
  "plan-not-provisioned":
    "This plan isn't wired up yet — our team is provisioning it.",
  "chargebee-not-implemented":
    "Checkout is coming online soon. Thanks for your patience.",
};

/** Extract the machine-readable error code from an axios / api-error shape. */
const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const data = (error as { data?: { error?: string } }).data;

  return typeof data?.error === "string" ? data.error : undefined;
};

export function PricingCards() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const plans = PRICING_PAGE_PLAN_IDS.map((id) => BILLING_PLANS[id]).filter(
    (p): p is BillingPlan => Boolean(p),
  );

  const handleSelect = async (plan: BillingPlan) => {
    if (!isSignedIn) {
      router.push(
        `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(
          ROUTES.PUBLIC.PRICING,
        )}`,
      );

      return;
    }

    setPendingPlanId(plan.id);

    try {
      const { url } = await billingService.startCheckout({
        planId: plan.id,
        returnUrl: `${window.location.origin}${ROUTES.APP.DASHBOARD}`,
      });

      window.location.href = url;
    } catch (error) {
      const code = errorCode(error);
      const message =
        code && KNOWN_ERRORS[code]
          ? KNOWN_ERRORS[code]
          : error instanceof Error
            ? error.message
            : "Something went wrong starting checkout.";

      toast.info({ title: "Checkout unavailable", description: message });
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, index) => (
        <PlanCard
          key={plan.id}
          ctaLabel={pendingPlanId === plan.id ? "Redirecting…" : "Choose plan"}
          featured={index === 1}
          isLoading={pendingPlanId === plan.id}
          plan={plan}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
