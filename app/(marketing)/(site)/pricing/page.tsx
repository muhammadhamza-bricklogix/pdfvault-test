import type { Metadata } from "next";

import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  description: "Simple, transparent plans for Content Clicks LLC — details coming soon.",
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10 text-center sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
        Pricing
      </h1>
      <p className="text-default-600 dark:text-default-400">
        We are finalizing plans for Content Clicks LLC. Contact us for early access, team
        pricing, or questions about what will be included in each tier.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
  );
}
