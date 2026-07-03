"use client";

import type { Entitlement } from "@/lib/shared/types/billing.types";

import { Button, Card } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";

import {
  useEntitlementQuery,
  useInvoicesQuery,
} from "@/lib/client/query/queries/billing.query";
import { billingService } from "@/lib/shared/api/services/billing.service";
import { BILLING_PLANS } from "@/lib/shared/constants/billing";
import { ROUTES } from "@/lib/shared/constants/routes";
import { isEntitlementActive } from "@/lib/shared/types/billing.types";
import { toast } from "@/lib/shared/utils/toast";

const STATUS_LABEL: Record<Entitlement["status"], string> = {
  none: "No active plan",
  trialing: "In trial",
  active: "Active",
  past_due: "Payment past due",
  paused: "Paused",
  cancelled: "Cancelled",
  expired: "Expired",
};

const formatDate = (value: number | string | null | undefined): string => {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? new Date(value) : new Date(value);

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatMoney = (cents: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
};

const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const data = (error as { data?: { error?: string } }).data;

  return typeof data?.error === "string" ? data.error : undefined;
};

export function BillingSettings() {
  const { data: entitlement } = useEntitlementQuery();
  const { data: invoices } = useInvoicesQuery({
    enabled: Boolean(entitlement && entitlement.status !== "none"),
  });
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const plan = entitlement?.planId ? BILLING_PLANS[entitlement.planId] : null;
  const active = isEntitlementActive(entitlement);

  const openPortal = async () => {
    setIsOpeningPortal(true);

    try {
      const { url } = await billingService.openPortal();

      window.location.href = url;
    } catch (error) {
      const code = errorCode(error);
      const description =
        code === "chargebee-not-implemented" ||
        code === "billing-not-configured"
          ? "Self-serve portal is coming online soon. Contact support in the meantime."
          : code === "no-billing-customer"
            ? "You don't have a billing account yet. Pick a plan to get started."
            : error instanceof Error
              ? error.message
              : "Please try again shortly.";

      toast.info({ title: "Portal unavailable", description });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  if (!entitlement || !active) {
    return (
      <Card className="rounded-2xl border border-default-200 bg-content1 p-6 dark:border-default-700">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-foreground)]">
              You don&apos;t have an active plan
            </h3>
            <p className="mt-1 text-sm text-default-500">
              Status:{" "}
              {entitlement
                ? STATUS_LABEL[entitlement.status]
                : STATUS_LABEL.none}
            </p>
          </div>
          <div>
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-background)]"
              href={ROUTES.PUBLIC.PRICING}
            >
              Choose a plan
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border border-default-200 bg-content1 p-6 dark:border-default-700">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                {plan?.label ?? "Subscription"}
              </h3>
              <p className="mt-1 text-sm text-default-500">
                {STATUS_LABEL[entitlement.status]}
                {entitlement.cancelAtPeriodEnd
                  ? " · cancel scheduled at period end"
                  : ""}
              </p>
            </div>
            {plan ? (
              <p className="text-xl font-bold text-[var(--color-foreground)]">
                {plan.priceLabel}
              </p>
            ) : null}
          </div>

          <dl className="grid gap-3 border-t border-default-200 pt-4 text-sm dark:border-default-700 sm:grid-cols-2">
            <div>
              <dt className="text-default-500">
                {entitlement.status === "trialing"
                  ? "Trial ends"
                  : "Next renewal"}
              </dt>
              <dd className="mt-0.5 font-medium text-[var(--color-foreground)]">
                {formatDate(
                  entitlement.status === "trialing"
                    ? entitlement.trialEndsAt
                    : entitlement.currentPeriodEnd,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-default-500">Last updated</dt>
              <dd className="mt-0.5 font-medium text-[var(--color-foreground)]">
                {formatDate(entitlement.updatedAt)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button
              isDisabled={isOpeningPortal}
              variant="primary"
              onPress={() => void openPortal()}
            >
              {isOpeningPortal ? "Opening…" : "Manage subscription"}
            </Button>
            <Button
              isDisabled={isOpeningPortal}
              variant="secondary"
              onPress={() => void openPortal()}
            >
              Cancel subscription
            </Button>
          </div>
          <p className="text-xs text-default-500">
            Cancelling stops future renewals immediately. You keep access until
            the end of the current period.
          </p>
        </div>
      </Card>

      <Card className="rounded-2xl border border-default-200 bg-content1 p-6 dark:border-default-700">
        <h3 className="text-base font-semibold text-[var(--color-foreground)]">
          Invoices
        </h3>
        {invoices && invoices.length > 0 ? (
          <ul className="mt-3 divide-y divide-default-200 text-sm dark:divide-default-700">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--color-foreground)]">
                    {invoice.invoiceNumber ?? invoice.chargebeeInvoiceId}
                  </p>
                  <p className="text-xs text-default-500">
                    {formatDate(invoice.issuedAt)} · {invoice.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[var(--color-foreground)]">
                    {formatMoney(invoice.amountCents, invoice.currency)}
                  </span>
                  {invoice.pdfUrl ? (
                    <a
                      className="text-xs text-[var(--color-accent)] underline"
                      href={invoice.pdfUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      PDF
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-default-500">
            Invoices appear here once billing is fully connected. In the
            meantime you can request receipts via{" "}
            <Link className="underline" href={ROUTES.LEGAL.CONTACT}>
              support
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
