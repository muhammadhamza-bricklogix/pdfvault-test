"use client";

import type { SubscriptionSnapshot } from "@/lib/shared/types/billing.types";

import { Button } from "@heroui/react";
import { useState } from "react";

import { CancellationFlow } from "@/components/sections/billing/CancellationFlow";
import { InvoicesTable } from "@/components/sections/billing/InvoicesTable";
import { useRestoreSubscriptionMutation } from "@/lib/client/query/mutations/cancel-subscription.mutation";
import { useSyncSubscriptionMutation } from "@/lib/client/query/mutations/billing.mutation";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";
import { toast } from "@/lib/shared/utils/toast";

import { PvSectionHeading } from "./pv-settings-primitives";

/**
 * `/dashboard/settings/billing` — reads the live subscription snapshot
 * and renders one of five cards:
 *   - NONE            → paywall CTA + trust badges
 *   - TRIALING        → trial countdown + Cancel + auto-renews at date
 *   - ACTIVE          → next renewal date + Cancel
 *   - PAST_DUE        → update-card CTA + Cancel
 *   - CANCELLED (grace) → access-until + Renew
 *   - CANCELLED (terminal) → paywall CTA
 *
 * A manual "Refresh" button beside the plan header calls
 * `POST /billing/subscription/sync` — pulls latest state from Solidgate
 * REST + upserts locally. Useful when the webhook path isn't wired yet
 * (local dev, staging without a public tunnel).
 */
export function BillingSettingsSection() {
  const { data: sub, isLoading, refetch } = useSubscriptionQuery();
  const restore = useRestoreSubscriptionMutation();
  const sync = useSyncSubscriptionMutation();
  const [cancelOpen, setCancelOpen] = useState(false);

  const handleRefresh = async () => {
    try {
      const result = await sync.mutateAsync({});

      await refetch();
      toast.success({
        title: "Subscription refreshed",
        description: `${result.synced} subscription${result.synced === 1 ? "" : "s"} synced from Solidgate.`,
      });
    } catch {
      toast.error({
        title: "Couldn't refresh",
        description: "Please try again or contact support.",
      });
    }
  };

  if (isLoading || !sub) {
    return (
      <p className="py-6 text-sm text-[var(--pv-text-muted)]">Loading…</p>
    );
  }

  const hasSubscription = sub.status !== "NONE";

  return (
    <section>
      <div className="flex items-center justify-between">
        <PvSectionHeading
          description="Manage your PDFVault subscription and view upcoming charges."
          title="Your subscription"
        />
        <Button
          isDisabled={sync.isPending}
          size="sm"
          variant="secondary"
          onPress={() => void handleRefresh()}
        >
          {sync.isPending ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {hasSubscription ? (
        <SubscriptionCard
          restoring={restore.isPending}
          sub={sub}
          onCancel={() => setCancelOpen(true)}
          onRestore={() => restore.mutate()}
        />
      ) : (
        <NoSubscriptionCard />
      )}

      <PvSectionHeading
        description="Download receipts for all past charges."
        title="Invoices"
      />
      <div className="mt-4">
        <InvoicesTable />
      </div>

      <CancellationFlow
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
      />
    </section>
  );
}

function NoSubscriptionCard() {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--pv-hairline-strong)] bg-[var(--pv-surface)] p-6 text-center">
      <p className="text-[14px] font-semibold text-[var(--pv-text-strong)]">
        You&apos;re on the free plan
      </p>
      <p className="text-[13px] text-[var(--pv-text-muted)]">
        Start a 7-day trial for $0.99 to unlock conversions, exports, and
        sharing. Cancel anytime.
      </p>
      <p className="text-[12px] text-[var(--pv-text-muted)]">
        The paywall appears the next time you try to convert, share, or
        export a file.
      </p>
    </div>
  );
}

function SubscriptionCard({
  sub,
  onCancel,
  onRestore,
  restoring,
}: {
  sub: SubscriptionSnapshot;
  onCancel: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[var(--pv-hairline-strong)] bg-[var(--pv-surface)] p-5">
      <StatusRow sub={sub} />

      {sub.trialEndsAt ? (
        <MetaRow
          label="Trial ends"
          subtext={daysUntil(sub.trialEndsAt)}
          value={formatDate(sub.trialEndsAt)}
        />
      ) : null}

      {sub.currentPeriodEnd ? (
        <MetaRow
          label={sub.cancelledButActive ? "Access until" : "Next renewal"}
          subtext={
            sub.cancelledButActive ? undefined : daysUntil(sub.currentPeriodEnd)
          }
          value={formatDate(sub.currentPeriodEnd)}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {sub.cancelledButActive ? (
          <Button
            isDisabled={restoring}
            variant="primary"
            onPress={onRestore}
          >
            {restoring ? "Renewing…" : "Renew subscription"}
          </Button>
        ) : (
          <Button variant="secondary" onPress={onCancel}>
            Cancel subscription
          </Button>
        )}
      </div>

      <p className="mt-1 text-[12px] leading-relaxed text-[var(--pv-text-muted)]">
        You can also cancel by emailing{" "}
        <a className="underline" href="mailto:payments@pdfvault.ai">
          payments@pdfvault.ai
        </a>{" "}
        before your next renewal.
      </p>
    </div>
  );
}

function StatusRow({ sub }: { sub: SubscriptionSnapshot }) {
  const label = statusLabel(sub);

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] text-[var(--pv-text-muted)]">Plan</p>
        <p className="text-[15px] font-semibold text-[var(--pv-text-strong)]">
          {sub.planName ?? "PDFVault Pro"}
        </p>
      </div>
      <StatusBadge label={label} status={sub.status} />
    </div>
  );
}

function MetaRow({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--pv-hairline)] pt-3">
      <p className="text-[13px] text-[var(--pv-text-muted)]">{label}</p>
      <div className="text-right">
        <p className="text-[14px] font-medium text-[var(--pv-text-strong)]">
          {value}
        </p>
        {subtext ? (
          <p className="text-[12px] text-[var(--pv-text-muted)]">{subtext}</p>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "ACTIVE" || status === "TRIALING"
      ? "bg-success-50 text-success-700"
      : status === "PAST_DUE"
        ? "bg-warning-50 text-warning-700"
        : "bg-default-100 text-default-600";

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function statusLabel(sub: SubscriptionSnapshot): string {
  if (sub.cancelledButActive) return "Cancelled — access continues";

  switch (sub.status) {
    case "TRIALING":
      return "Trial";
    case "ACTIVE":
      return "Active";
    case "PAST_DUE":
      return "Payment past due";
    case "CANCELLED":
      return "Cancelled";
    case "PAUSED":
      return "Paused";
    default:
      return "No subscription";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Human-friendly "in 5 days" / "today" / "yesterday" from an ISO date.
 * Reads nicer in a settings row than a bare date.
 */
function daysUntil(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const days = Math.round((target - now) / (24 * 60 * 60 * 1000));

  if (days > 1) return `in ${days} days`;
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  if (days === -1) return "yesterday";

  return `${Math.abs(days)} days ago`;
}
