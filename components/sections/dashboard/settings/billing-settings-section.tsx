"use client";

import type { SubscriptionSnapshot } from "@/lib/shared/types/billing.types";

import { Button } from "@heroui/react";
import { useState } from "react";

import { useRestoreSubscriptionMutation } from "@/lib/client/query/mutations/cancel-subscription.mutation";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";

import { PvSectionHeading } from "./pv-settings-primitives";

/**
 * "Your current plan" panel for /dashboard/settings/billing. Reads the
 * live subscription snapshot and exposes:
 *   - Status + plan name + next-billing / trial-end date
 *   - "Cancel subscription" (opens the cancellation flow in Phase 5)
 *   - "Renew" — only visible when the sub is cancelled-but-active
 *   - Fallback text pointing users at the email-to-support cancellation
 *     path (compliance line — self-serve cancel must be advertised even
 *     when it exists)
 */
export function BillingSettingsSection() {
  const { data: sub, isLoading } = useSubscriptionQuery();
  const restore = useRestoreSubscriptionMutation();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading || !sub) {
    return <p className="py-6 text-sm text-[var(--pv-text-muted)]">Loading…</p>;
  }

  return (
    <section>
      <PvSectionHeading
        description="Manage your PDFVault subscription and view upcoming charges."
        title="Your subscription"
      />

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[var(--pv-hairline-strong)] bg-[var(--pv-surface)] p-5">
        <StatusRow sub={sub} />

        {sub.currentPeriodEnd ? (
          <MetaRow
            label={sub.cancelledButActive ? "Access until" : "Next renewal"}
            value={formatDate(sub.currentPeriodEnd)}
          />
        ) : null}

        {sub.trialEndsAt ? (
          <MetaRow label="Trial ends" value={formatDate(sub.trialEndsAt)} />
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2">
          {sub.cancelledButActive ? (
            <Button
              isDisabled={restore.isPending}
              variant="primary"
              onPress={() => restore.mutate()}
            >
              {restore.isPending ? "Renewing…" : "Renew subscription"}
            </Button>
          ) : sub.entitled ? (
            <Button variant="secondary" onPress={() => setCancelOpen(true)}>
              Cancel subscription
            </Button>
          ) : null}
        </div>

        <p className="mt-1 text-[12px] leading-relaxed text-[var(--pv-text-muted)]">
          You can also cancel by emailing{" "}
          <a className="underline" href="mailto:payments@pdfvault.ai">
            payments@pdfvault.ai
          </a>{" "}
          before your next renewal.
        </p>
      </div>

      {cancelOpen ? (
        <div className="mt-4 rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
          Cancellation flow ships in Phase 5. This modal will host the feedback
          form + Tier-1 / Tier-2 downsell offers.
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onPress={() => setCancelOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </section>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--pv-hairline)] pt-3">
      <p className="text-[13px] text-[var(--pv-text-muted)]">{label}</p>
      <p className="text-[14px] font-medium text-[var(--pv-text-strong)]">
        {value}
      </p>
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
