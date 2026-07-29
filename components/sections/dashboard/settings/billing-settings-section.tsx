"use client";

import type { SubscriptionSnapshot } from "@/lib/shared/types/billing.types";

import { Button, Modal } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { CancellationFlow } from "@/components/sections/billing/CancellationFlow";
import { InvoicesTable } from "@/components/sections/billing/InvoicesTable";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import {
  useHardCancelSubscriptionMutation,
  useRestoreSubscriptionMutation,
} from "@/lib/client/query/mutations/cancel-subscription.mutation";
import {
  useSyncHistoryMutation,
  useSyncSubscriptionMutation,
} from "@/lib/client/query/mutations/billing.mutation";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";
import { toast } from "@/lib/shared/utils/toast";

import { PvSectionHeading } from "./pv-settings-primitives";

/**
 * `/dashboard/settings/billing` — three stacked sections:
 *   1. "Your subscription" — plan card + Cancel / Renew actions
 *   2. "Billing history" — invoices table
 *   3. "Advanced" — Close-subscription escape hatch, only when a
 *      subscription row exists
 *
 * No third-party payment-processor names in user-visible copy — all
 * "Solidgate" mentions live in code comments / API paths only.
 */
export function BillingSettingsSection() {
  const { data: sub, isLoading, refetch } = useSubscriptionQuery();
  const restore = useRestoreSubscriptionMutation();
  const sync = useSyncSubscriptionMutation();
  const syncHistory = useSyncHistoryMutation();
  const hardCancel = useHardCancelSubscriptionMutation();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const autoSyncFiredRef = useRef(false);
  // Timestamp of the last successful local cancellation. If the user
  // clicks Refresh within a short window, we skip the Solidgate sync —
  // Solidgate replication can take up to a minute or two, and pulling
  // fresh state during that window resurrects the just-cancelled
  // subscription in the UI. Persisted to sessionStorage so a reload
  // doesn't drop the guard.
  const CANCEL_COOLDOWN_MS = 120_000;
  const [justCancelledAt, setJustCancelledAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("pdfvault:justCancelledAt");
    const parsed = raw ? Number(raw) : NaN;

    return Number.isFinite(parsed) ? parsed : null;
  });

  const markJustCancelled = () => {
    const now = Date.now();

    setJustCancelledAt(now);
    try {
      window.sessionStorage.setItem("pdfvault:justCancelledAt", String(now));
    } catch {
      // sessionStorage disabled in private mode — the in-memory
      // state still guards the current session.
    }
  };

  const clearJustCancelled = () => {
    setJustCancelledAt(null);
    try {
      window.sessionStorage.removeItem("pdfvault:justCancelledAt");
    } catch {
      // ignore
    }
  };

  // Auto-run the deep history sync once on mount so the invoices list
  // reflects Solidgate truth even when webhook delivery was flaky.
  // Ref-guarded so a React strict-mode double-mount doesn't fire it
  // twice. Silent on failure — the manual "Sync history" button
  // surfaces errors clearly if the user chooses to retry.
  useEffect(() => {
    if (autoSyncFiredRef.current) return;
    autoSyncFiredRef.current = true;
    syncHistory.mutate(undefined, {
      onSettled: () => {
        void refetch();
      },
    });
  }, []);

  const handleSyncHistory = () => {
    syncHistory.mutate(undefined, {
      onSuccess: (result) => {
        toast.success({
          title: "Billing history synced",
          description:
            result.payments > 0
              ? `${result.payments} new charge${result.payments === 1 ? "" : "s"} loaded from your payment history.`
              : "Your billing history is already up to date.",
        });
      },
      onError: () =>
        toast.error({
          title: "Couldn't sync history",
          description: "Please try again in a moment.",
        }),
    });
  };

  const handleRestore = () => {
    restore.mutate(undefined, {
      onSuccess: (result) => {
        if (result?.message) {
          toast.info({
            title: "Subscription cleaned up",
            description: result.message,
          });
        } else {
          toast.success({
            title: "Subscription renewed",
            description: "You're back on your plan.",
          });
        }
      },
      onError: () =>
        toast.error({
          title: "Couldn't renew",
          description:
            "Something went wrong. Please try again or email payments@pdfvault.ai.",
        }),
    });
  };

  const handleRefresh = async () => {
    // If the user just cancelled locally, skip the Solidgate sync —
    // that endpoint pulls live Solidgate state and will happily rewrite
    // the local row back to ACTIVE if replication hasn't caught up
    // (usually a minute or two). Show a friendly holding message
    // instead. After the cooldown window elapses the button behaves
    // normally again.
    if (
      justCancelledAt !== null &&
      Date.now() - justCancelledAt < CANCEL_COOLDOWN_MS
    ) {
      toast.info({
        title: "Cancellation still processing",
        description:
          "It can take a couple of minutes for the payment processor to confirm your cancellation. Please check back shortly.",
      });

      return;
    }

    try {
      const result = await sync.mutateAsync({});

      await refetch();
      toast.success({
        title: "Up to date",
        description:
          result.synced > 0
            ? `Latest ${result.synced === 1 ? "subscription" : `${result.synced} subscriptions`} loaded.`
            : "Your subscription is up to date.",
      });
      // Refresh past the cooldown window with the backend reporting a
      // stable state — clear the guard so future refreshes hit sync
      // normally.
      clearJustCancelled();
    } catch {
      toast.error({
        title: "Couldn't refresh",
        description: "Please try again in a moment.",
      });
    }
  };

  const handleCloseSubscription = async () => {
    setCloseConfirmOpen(false);
    try {
      const result = await hardCancel.mutateAsync();

      // Force a synchronous refetch so the UI flips to
      // NoSubscriptionCard immediately, before the toast fires. Without
      // this, `invalidateQueries` in the mutation's onSuccess kicks the
      // refetch async and users can see the "Renew" / "Close" buttons
      // for a beat while the query rehydrates.
      await refetch();

      // Guard: block the Refresh button's Solidgate sync for the next
      // couple of minutes. Without this, Refresh would happily pull
      // the still-active subscription back from Solidgate before their
      // side has processed the cancel, resurrecting the row visually.
      markJustCancelled();

      toast.success({
        title: "Subscription closed",
        description:
          result.solidgateStatus === "cancelled"
            ? "Your subscription has been closed and your account is ready for a fresh start."
            : result.solidgateStatus === "not_found"
              ? "No active subscription was found. Your account is ready for a fresh start."
              : "The subscription record on your account has been cleared.",
      });
    } catch {
      toast.error({
        title: "Couldn't close subscription",
        description: "Please try again or email payments@pdfvault.ai for help.",
      });
    }
  };

  if (isLoading || !sub) {
    return <p className="py-6 text-sm text-[var(--pv-text-muted)]">Loading…</p>;
  }

  const hasSubscription = sub.status !== "NONE";

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
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
          onRestore={handleRestore}
        />
      ) : (
        <NoSubscriptionCard />
      )}

      <div className="flex items-center justify-between gap-4">
        <PvSectionHeading
          description="Every past charge with a downloadable receipt."
          title="Billing history"
        />
        <Button
          isDisabled={syncHistory.isPending}
          size="sm"
          variant="secondary"
          onPress={handleSyncHistory}
        >
          {syncHistory.isPending ? "Syncing…" : "Sync history"}
        </Button>
      </div>
      <div className="mt-4">
        <InvoicesTable />
      </div>

      {/* Advanced / Close-subscription escape hatch — hidden 2026-07-23
          per product decision. Keep AdvancedSection + CloseSubscriptionModal
          mounted-and-ready code below in case we need to re-enable during
          an incident, but do not render the section by default.
      {hasSubscription ? (
        <AdvancedSection
          busy={hardCancel.isPending}
          onOpenClose={() => setCloseConfirmOpen(true)}
        />
      ) : null}
      */}

      <CancellationFlow
        isOpen={cancelOpen}
        onCancelled={markJustCancelled}
        onClose={() => setCancelOpen(false)}
      />

      <CloseSubscriptionModal
        busy={hardCancel.isPending}
        isOpen={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={() => void handleCloseSubscription()}
      />
    </section>
  );
}

function NoSubscriptionCard() {
  const handleAdd = () => {
    void requestPaywall();
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--pv-hairline-strong)] bg-[var(--pv-surface)] p-8 text-center">
      <p className="text-[15px] font-semibold text-[var(--pv-text-strong)]">
        You&apos;re on the free plan
      </p>
      <p className="max-w-md text-[13px] text-[var(--pv-text-muted)]">
        Start a 7-day trial for $0.99 to unlock conversions, exports, and
        sharing. Cancel anytime.
      </p>
      <Button variant="primary" onPress={handleAdd}>
        Add billing method
      </Button>
      <p className="text-[12px] text-[var(--pv-text-muted)]">
        The paywall also appears the next time you convert, share, or export a
        file.
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
          <Button isDisabled={restoring} variant="primary" onPress={onRestore}>
            {restoring ? "Renewing…" : "Renew subscription"}
          </Button>
        ) : sub.status === "CANCELLED" ? (
          <p className="text-[13px] text-[var(--pv-text-muted)]">
            This subscription is closed. Start a new one from any Convert /
            Download action.
          </p>
        ) : (
          <Button variant="secondary" onPress={onCancel}>
            Cancel subscription
          </Button>
        )}
        <Button variant="secondary" onPress={() => void requestPaywall()}>
          Add billing method
        </Button>
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

function AdvancedSection({
  busy,
  onOpenClose,
}: {
  busy: boolean;
  onOpenClose: () => void;
}) {
  return (
    <>
      <PvSectionHeading
        description="Rarely needed. Use these only if the standard Cancel option isn't working."
        title="Advanced"
      />
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-danger-200 bg-danger-50/40 p-5">
        <div>
          <p className="text-[13px] font-semibold text-danger-700">
            Close subscription immediately
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--pv-text-muted)]">
            Ends your subscription right away instead of at the end of the
            billing period. Your account returns to the free plan. Use this when
            the standard Cancel button isn&apos;t working, when a trial was
            declined, or when you want a clean slate to restart.
          </p>
        </div>
        <div>
          <Button isDisabled={busy} variant="danger" onPress={onOpenClose}>
            {busy ? "Closing…" : "Close subscription"}
          </Button>
        </div>
      </div>
    </>
  );
}

function CloseSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  busy,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[440px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Close this subscription?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-default-700">
              Your subscription will end immediately and you&apos;ll return to
              the free plan. This action can&apos;t be undone — you would need
              to start a new subscription to regain paid access.
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-[13px] text-default-600">
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger-400"
                />
                <span>All auto-renewals stop right now.</span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger-400"
                />
                <span>You lose access to paid features immediately.</span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger-400"
                />
                <span>Past invoices remain available on this page.</span>
              </li>
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button isDisabled={busy} variant="secondary" onPress={onClose}>
              Keep subscription
            </Button>
            <Button isDisabled={busy} variant="danger" onPress={onConfirm}>
              {busy ? "Closing…" : "Yes, close it"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
