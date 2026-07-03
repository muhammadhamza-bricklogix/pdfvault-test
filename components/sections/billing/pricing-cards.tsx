"use client";

import type { BillingPlan } from "@/lib/shared/constants/billing";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  "plan-not-provisioned":
    "This plan isn't wired up yet — our team is provisioning it.",
  "checkout-not-implemented":
    "Checkout is coming online soon. Thanks for your patience.",
  "unknown-plan": "Plan not found. Please refresh and try again.",
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
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          returnUrl: `${window.location.origin}${ROUTES.APP.DASHBOARD}`,
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
