"use client";

import type { BillingPlan } from "@/lib/shared/constants/billing";

import { Button, Card } from "@heroui/react";
import { useId, useState } from "react";

interface PlanCardProps {
  plan: BillingPlan;
  featured?: boolean;
  ctaLabel: string;
  isLoading?: boolean;
  onSelect: (plan: BillingPlan) => void;
}

export function PlanCard({
  plan,
  featured,
  ctaLabel,
  isLoading,
  onSelect,
}: PlanCardProps) {
  const [consented, setConsented] = useState(false);
  const consentId = useId();

  return (
    <Card
      className={`flex h-full flex-col gap-4 rounded-2xl border p-6 ${
        featured
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-lg"
          : "border-default-200 bg-content1 dark:border-default-700"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
          {plan.label}
        </h3>
        {featured ? (
          <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-background)]">
            Popular
          </span>
        ) : null}
      </div>

      <div className="text-3xl font-bold text-[var(--color-foreground)]">
        {plan.priceLabel}
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-default-600 dark:text-default-300">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 text-[var(--color-accent)]"
            >
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/*
        Renewal disclosure and consent checkbox are legally required to be
        adjacent to the CTA. Do not hide, collapse, or fade this block.
      */}
      <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs leading-relaxed text-warning-800 dark:border-warning-800/50 dark:bg-warning-950/30 dark:text-warning-200">
        <p className="font-semibold">Renewal terms</p>
        <p className="mt-1">{plan.renewalDisclosure}</p>
      </div>

      <label
        className="flex items-start gap-2 text-xs text-default-600 dark:text-default-300"
        htmlFor={consentId}
      >
        <input
          checked={consented}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          id={consentId}
          type="checkbox"
          onChange={(e) => setConsented(e.currentTarget.checked)}
        />
        <span>
          I authorize the charge described above and understand it renews
          automatically until I cancel.
        </span>
      </label>

      <Button
        className="mt-auto"
        isDisabled={!consented || isLoading}
        variant={featured ? "primary" : "secondary"}
        onPress={() => onSelect(plan)}
      >
        {ctaLabel}
      </Button>
    </Card>
  );
}
