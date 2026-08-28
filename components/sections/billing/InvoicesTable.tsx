"use client";

import type { Invoice } from "@/lib/shared/types/billing.types";

import { useUser } from "@clerk/nextjs";
import { EyeIcon, DownloadCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";

import {
  generateReceiptPdf,
  receiptFileName,
} from "@/lib/client/billing/generate-receipt-pdf";
import {
  persistUserCurrency,
  readPersistedUserCurrency,
  resolveDisplayCurrency,
} from "@/lib/client/billing/user-currency";
import {
  useInvoicesQuery,
  usePlansQuery,
  useSubscriptionQuery,
} from "@/lib/client/query/queries/billing.query";
import { formatMinorWithCode } from "@/lib/shared/utils/currency";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Invoice history table for the billing settings tab. Reads Payment
 * rows tagged with a Solidgate-generated `invoiceNumber`. The View +
 * Download actions generate a PDFVault-branded receipt on the fly
 * (client-side pdf-lib) so the user sees our logo instead of the
 * Solidgate-hosted PDF — matches the QA 2026-08-28 ask to "have our
 * logo on the payment receipt".
 */
export function InvoicesTable() {
  const { data, isLoading } = useInvoicesQuery();
  const { data: subscription } = useSubscriptionQuery();
  const { data: plans } = usePlansQuery();
  const { user } = useUser();

  // Region-correct currency for this user. `Plan[]` from
  // `/billing/plans` is localised server-side by the visitor's country
  // (same signal Solidgate uses at checkout), so its currency is the
  // ground truth we use to override the backend's Payment-writer bug
  // that stamps every invoice as "USD" regardless of actual charge
  // currency. Falls back to a previously persisted value so the paywall
  // → invoice hand-off works before Plans query resolves.
  const regionCurrency = useMemo(() => {
    const fromPlans = plans?.find((p) => p.currency)?.currency ?? null;

    return fromPlans ?? readPersistedUserCurrency();
  }, [plans]);

  // Persist Plans-derived currency so downstream surfaces that don't
  // themselves hit /billing/plans (paywall's synthesized receipt) still
  // see it. `persistUserCurrency` is idempotent + a no-op on missing input.
  useEffect(() => {
    if (regionCurrency) persistUserCurrency(regionCurrency);
  }, [regionCurrency]);

  if (isLoading) {
    return <p className="py-4 text-sm text-default-500">Loading invoices…</p>;
  }

  if (!data || data.length === 0) {
    return <p className="py-4 text-sm text-default-500">No invoices yet.</p>;
  }

  const customerEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const planName = subscription?.planName ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--pv-hairline-strong)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-default-50 text-[12px] uppercase tracking-wide text-default-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Receipt actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <InvoiceRow
              key={row.id}
              customerEmail={customerEmail}
              planName={planName}
              regionCurrency={regionCurrency}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceRow({
  row,
  customerEmail,
  planName,
  regionCurrency,
}: {
  row: Invoice;
  customerEmail: string | null;
  planName: string | null;
  regionCurrency: string | null;
}) {
  // Backend Payment writer stamps every invoice as USD regardless of
  // the actual Solidgate charge currency (QA 2026-08-28 → 29, e.g.
  // PKR-paid subscription showing "$275.22 USD"). `regionCurrency`
  // comes from `/billing/plans` — server-side localised to the user's
  // country, same signal Solidgate uses at checkout — so we use it as
  // the display currency when the backend defaulted to USD.
  // See `lib/client/billing/user-currency.ts` for the full rationale.
  const displayCurrency = resolveDisplayCurrency(row.currency, regionCurrency);
  const formatted = formatMinorWithCode(row.amountMinor, displayCurrency);

  // Diagnostic breadcrumb: if the raw `row.currency` from the backend
  // ever disagrees with what the user expects (e.g. row says USD but
  // the user believes they paid PKR), we can spot it in the console
  // without wiring a full server-side audit. Only fires in dev / when
  // logger's debug level is enabled — production stays quiet.
  logger.debug?.("[billing.invoice.row]", {
    id: row.id,
    amountMinor: row.amountMinor,
    backendCurrency: row.currency,
    regionCurrency,
    displayCurrency,
    status: row.status,
    type: row.type,
    formatted,
  });

  const date = new Date(row.paidAt ?? row.createdAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" },
  );

  // Hand the currency-corrected copy of the invoice to the receipt
  // generator so the PDF matches the table row (backend row is left
  // untouched — it's still the source of truth for id / status / etc).
  const invoiceForReceipt: Invoice = { ...row, currency: displayCurrency };

  return (
    <tr className="border-t border-[var(--pv-hairline)]">
      <td className="px-3 py-2 text-default-700">{date}</td>
      <td className="px-3 py-2 font-mono text-[12px] text-default-600">
        {row.invoiceNumber}
      </td>
      <td className="px-3 py-2">{formatted}</td>
      <td className="px-3 py-2">
        <StatusPill status={row.status} />
      </td>
      <td className="px-3 py-2 text-right">
        <ReceiptActions
          customerEmail={customerEmail}
          invoice={invoiceForReceipt}
          planName={planName}
        />
      </td>
    </tr>
  );
}

/**
 * View + Download buttons for the receipt column. Both share a single
 * `generateReceiptPdf` call so we don't re-render the same PDF twice for
 * a user who clicks View then Download. Cached bytes are held per-row.
 */
function ReceiptActions({
  invoice,
  customerEmail,
  planName,
}: {
  invoice: Invoice;
  customerEmail: string | null;
  planName: string | null;
}) {
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const [cachedBlobUrl, setCachedBlobUrl] = useState<string | null>(null);

  const getBlobUrl = async (): Promise<string> => {
    if (cachedBlobUrl) return cachedBlobUrl;
    const bytes = await generateReceiptPdf(invoice, {
      customerEmail,
      planName,
    });
    const blob = new Blob([bytes as BlobPart], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);

    setCachedBlobUrl(url);

    return url;
  };

  const handleView = async () => {
    if (busy) return;
    setBusy("view");
    try {
      const url = await getBlobUrl();

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      logger.captureError(err, "billing.receipt.view");
      toast.error({
        title: "Couldn't open receipt",
        description:
          err instanceof Error
            ? err.message
            : "Try again in a moment or use Download.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy("download");
    try {
      const url = await getBlobUrl();
      const link = document.createElement("a");

      link.href = url;
      link.download = receiptFileName(invoice);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      logger.captureError(err, "billing.receipt.download");
      toast.error({
        title: "Couldn't download receipt",
        description:
          err instanceof Error
            ? err.message
            : "Try again in a moment or use View.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        aria-label="View receipt"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-default-800 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={busy !== null}
        title="View receipt"
        type="button"
        onClick={() => void handleView()}
      >
        <HugeiconsIcon icon={EyeIcon} size={16} />
      </button>
      <button
        aria-label="Download receipt"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-default-800 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={busy !== null}
        title="Download receipt"
        type="button"
        onClick={() => void handleDownload()}
      >
        <HugeiconsIcon icon={DownloadCircle02Icon} size={16} />
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: Invoice["status"] }) {
  const tone =
    status === "APPROVED"
      ? "bg-success-50 text-success-700"
      : status === "REFUNDED"
        ? "bg-warning-50 text-warning-700"
        : status === "DECLINED"
          ? "bg-danger-50 text-danger-700"
          : "bg-default-100 text-default-600";

  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${tone}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
