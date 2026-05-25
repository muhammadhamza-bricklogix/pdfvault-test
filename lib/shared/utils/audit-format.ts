import type { AuditEvent } from "@/lib/shared/types/audit.types";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes === 0) return "0 B";
  const i = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);

  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[i]}`;
}

/** Concise relative time without an external dep (Intl.RelativeTimeFormat). */
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);

  for (const { unit, seconds: unitSeconds } of UNITS) {
    if (Math.abs(seconds) >= unitSeconds || unit === "second") {
      return RELATIVE.format(Math.round(seconds / unitSeconds), unit);
    }
  }

  return "just now";
}

/** Human label for the activity row, e.g. "Downloaded as XLSX (1.2 MB)". */
export function describeAuditEvent(event: AuditEvent): string {
  const size =
    event.byteSize != null ? ` (${formatBytes(event.byteSize)})` : "";

  switch (event.action) {
    case "DOCUMENT_CREATED": {
      const src = event.sourceFormat
        ? ` from ${event.sourceFormat.toUpperCase()}`
        : "";

      return `Uploaded document${src}${size}`;
    }
    case "DOCUMENT_UPDATED": {
      const src = event.sourceFormat
        ? ` from ${event.sourceFormat.toUpperCase()}`
        : "";

      return `Saved edits${src}${size}`;
    }
    case "DOCUMENT_DOWNLOADED": {
      const tgt = event.targetFormat
        ? ` as ${event.targetFormat.toUpperCase()}`
        : "";
      const fromSrc =
        event.sourceFormat &&
        event.targetFormat &&
        event.sourceFormat !== event.targetFormat
          ? ` (converted from ${event.sourceFormat.toUpperCase()})`
          : "";

      return `Downloaded${tgt}${fromSrc}${size}`;
    }
    case "DOCUMENT_DELETED":
      return "Deleted document";
    default:
      return event.action;
  }
}
