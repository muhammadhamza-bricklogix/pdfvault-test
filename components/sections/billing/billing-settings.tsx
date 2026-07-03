"use client";

import type { Entitlement } from "@/lib/shared/types/billing.types";

import { Button, Card } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";

import { useEntitlementQuery } from "@/lib/client/query/queries/billing.query";
import { BILLING_PLANS } from "@/lib/shared/constants/billing";
import { ROUTES } from "@/lib/shared/constants/routes";
import { isEntitlementActive } from "@/lib/shared/types/billing.types";
import { toast } from "@/lib/shared/utils/toast";

interface BillingSettingsProps {
  initialEntitlement: Entitlement;
}

const STATUS_LABEL: Record<Entitlement["status"], string> = {
  none: "No active plan",
  trialing: "In trial",
  active: "Active",
  past_due: "Payment past due",
  paused: "Paused",
  cancelled: "Cancelled",
  expired: "Expired",
};

const formatDate = (unixMs: number | null): string => {
  if (!unixMs) {
    return "—";
  }

  return new Date(unixMs).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export function BillingSettings({ initialEntitlement }: BillingSettingsProps) {
  const { data } = useEntitlementQuery();
  const entitlement = data ?? initialEntitlement;
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const plan = entitlement.planId ? BILLING_PLANS[entitlement.planId] : null;
  const active = isEntitlementActive(entitlement);

  const openPortal = async () => {
    setIsOpeningPortal(true);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (res.ok && body.url) {
        window.location.href = body.url;

        return;
      }

      toast.info({
        title: "Portal unavailable",
        description:
          body.error === "portal-not-implemented"
            ? "Self-serve portal is coming online soon. Contact support in the meantime."
            : (body.error ?? "Please try again shortly."),
      });
    } catch (error) {
      toast.error({
        title: "Couldn't open portal",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  if (!active) {
    return (
      <Card className="rounded-2xl border border-default-200 bg-content1 p-6 dark:border-default-700">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-foreground)]">
              You don&apos;t have an active plan
            </h3>
            <p className="mt-1 text-sm text-default-500">
              Status: {STATUS_LABEL[entitlement.status]}
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
              <div className="text-right">
                <p className="text-xl font-bold text-[var(--color-foreground)]">
                  {plan.priceLabel}
                </p>
              </div>
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
        <p className="mt-1 text-sm text-default-500">
          Invoices appear here once billing is fully connected. In the meantime
          you can request receipts via{" "}
          <Link className="underline" href={ROUTES.LEGAL.CONTACT}>
            support
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
