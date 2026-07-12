"use client";

import type { Invoice } from "@/lib/shared/types/billing.types";

import { useInvoicesQuery } from "@/lib/client/query/queries/billing.query";

/**
 * Invoice history table for the billing settings tab. Reads Payment
 * rows tagged with a Solidgate-generated `invoiceNumber`. Download
 * button links straight at the Solidgate-hosted PDF via `invoiceUrl`
 * (target=_blank + rel=noopener so opening a new tab doesn't hand
 * Solidgate an opener reference to our tab).
 */
export function InvoicesTable() {
  const { data, isLoading } = useInvoicesQuery();

  if (isLoading) {
    return <p className="py-4 text-sm text-default-500">Loading invoices…</p>;
  }

  if (!data || data.length === 0) {
    return (
      <p className="py-4 text-sm text-default-500">No invoices yet.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--pv-hairline-strong)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-default-50 text-[12px] uppercase tracking-wide text-default-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">PDF</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <InvoiceRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceRow({ row }: { row: Invoice }) {
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: row.currency,
    minimumFractionDigits: 2,
  }).format(row.amountMinor / 100);

  const date = new Date(row.paidAt ?? row.createdAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" },
  );

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
        {row.invoiceUrl ? (
          <a
            className="text-primary underline"
            href={row.invoiceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Download
          </a>
        ) : (
          <span className="text-default-400">—</span>
        )}
      </td>
    </tr>
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
