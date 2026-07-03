import Link from "next/link";

import { BillingSettings } from "@/components/sections/billing/billing-settings";
import { isBillingEnabled } from "@/lib/shared/constants/billing";
import { ROUTES } from "@/lib/shared/constants/routes";

export default function BillingSettingsPage() {
  if (!isBillingEnabled()) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
            Billing
          </h2>
          <p className="text-sm text-default-500">
            Manage your subscription, view invoices, and cancel any time.
          </p>
        </header>
        <div className="rounded-2xl border border-default-200 bg-content1 p-6 dark:border-default-700">
          <p className="text-sm text-default-600 dark:text-default-400">
            Billing isn&apos;t live yet. Once it&apos;s enabled you&apos;ll be
            able to manage your plan from here.{" "}
            <Link className="underline" href={ROUTES.PUBLIC.PRICING}>
              See plans
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          Billing
        </h2>
        <p className="text-sm text-default-500">
          Manage your subscription, view invoices, and cancel any time.
        </p>
      </header>
      <BillingSettings />
    </div>
  );
}
