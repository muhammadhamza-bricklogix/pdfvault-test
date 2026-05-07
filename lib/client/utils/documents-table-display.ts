import type { Document } from "@/lib/shared/types/documents.types";

/** `YYYY-MM-DD` from `<input type="date">` interpreted as local midnight (not UTC). */
export function localDayStartMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());

  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();

  return Number.isNaN(t) ? null : t;
}

/** Exclusive end of that local calendar day (next local midnight). */
export function localDayEndExclusiveMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());

  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(y, mo - 1, d + 1, 0, 0, 0, 0).getTime();

  return Number.isNaN(t) ? null : t;
}

export type DocumentTableFilterParams = {
  dateFrom: string;
  dateTo: string;
  nameQuery: string;
};

export function documentMatchesTableFilters(
  doc: Document,
  { dateFrom, dateTo, nameQuery }: DocumentTableFilterParams,
): boolean {
  const q = nameQuery.trim().toLowerCase();

  if (q && !doc.filename.toLowerCase().includes(q)) return false;

  const fromMs = dateFrom ? localDayStartMs(dateFrom) : null;
  const toExclusiveMs = dateTo ? localDayEndExclusiveMs(dateTo) : null;
  const from = fromMs ?? -Infinity;
  const toExclusive = toExclusiveMs ?? Infinity;
  const t = new Date(doc.updatedAt).getTime();

  if (!Number.isFinite(t)) return false;
  if (t < from || t >= toExclusive) return false;

  return true;
}

export function formatDocumentBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function formatDocumentDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
