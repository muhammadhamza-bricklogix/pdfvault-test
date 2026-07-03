import type { Metadata } from "next";

import Link from "next/link";

import { PricingCards } from "@/components/sections/billing/pricing-cards";
import { isBillingEnabled } from "@/lib/shared/constants/billing";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  description:
    "Simple, transparent plans for PDFedits.io — pick the tier that fits how much you edit.",
  title: "Pricing",
};

export default function PricingPage() {
  const billingLive = isBillingEnabled();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-4xl">
          Simple pricing, transparent renewals
        </h1>
        <p className="text-default-600 dark:text-default-400">
          Every plan renews automatically until you cancel. You can cancel any
          time from your billing dashboard — as easily as you signed up.
        </p>
      </header>

      {billingLive ? (
        <PricingCards />
      ) : (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-default-200 bg-content1 p-8 text-center dark:border-default-700">
          <p className="text-default-600 dark:text-default-400">
            We are finalizing plans for PDFedits.io. Contact us for early
            access, team pricing, or questions about what will be included in
            each tier.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[var(--color-background)]"
              href={ROUTES.LEGAL.CONTACT}
            >
              Contact us
            </Link>
            <Link
              className="rounded-xl border border-default-200 px-6 py-3 text-sm font-semibold text-[var(--color-foreground)] dark:border-default-700"
              href={ROUTES.PUBLIC.HOME}
            >
              Back to home
            </Link>
          </div>
        </div>
      )}

      <p className="mx-auto max-w-2xl text-center text-xs text-default-500">
        Payments are processed securely by our billing partner. See our{" "}
        <Link className="underline" href={ROUTES.LEGAL.REFUND}>
          refund policy
        </Link>{" "}
        and{" "}
        <Link className="underline" href={ROUTES.LEGAL.TERMS}>
          terms
        </Link>{" "}
        for details.
      </p>
    </div>
  );
}
