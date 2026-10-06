"use client";

import { PDFDocument } from "pdf-lib";

export type PageRange = {
  /** 1-indexed inclusive page number. */
  start: number;
  /** 1-indexed inclusive page number. */
  end: number;
};

export type SplitMode = "ranges" | "everyN";

export type SplitSpec =
  | { mode: "ranges"; ranges: PageRange[] }
  | { mode: "everyN"; chunkSize: number };

export type SplitResult = {
  /** Suggested filename for the output entry (no extension stripping). */
  filename: string;
  bytes: Uint8Array;
  pageRange: PageRange;
};

const MAX_RANGES = 500;
const MAX_CHUNK_SIZE = 1000;

/**
 * Parse a human-friendly page-range string into discrete {start,end} pairs.
 *
 * Accepts: "1-3, 5, 8-10" (whitespace and trailing commas allowed).
 * Pages are 1-indexed; ranges are clamped against `pageCount` and any
 * malformed token returns an error with the offending fragment for the UI
 * to surface inline.
 */
export function parseRanges(
  input: string,
  pageCount: number,
): { ok: true; ranges: PageRange[] } | { ok: false; error: string } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: "Enter at least one page range." };
  }
  if (pageCount <= 0) {
    return { ok: false, error: "PDF has no pages." };
  }

  const tokens = trimmed
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, error: "Enter at least one page range." };
  }
  if (tokens.length > MAX_RANGES) {
    return {
      ok: false,
      error: `Too many ranges (max ${MAX_RANGES}).`,
    };
  }

  const ranges: PageRange[] = [];

  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:-(\d+))?$/);

    if (!match) {
      return { ok: false, error: `Couldn't read "${token}".` };
    }
    const start = Number(match[1]);
    const end = match[2] != null ? Number(match[2]) : start;

    if (start < 1 || end < 1) {
      return { ok: false, error: `"${token}" is below page 1.` };
    }
    if (start > pageCount || end > pageCount) {
      return {
        ok: false,
        error: `"${token}" is beyond page ${pageCount}.`,
      };
    }
    if (start > end) {
      return { ok: false, error: `"${token}" starts after it ends.` };
    }
    ranges.push({ start, end });
  }

  return { ok: true, ranges };
}

/**
 * Synthesise the ranges for an "every N pages" split. Returns an empty list
 * when the input is invalid so the caller can show the same validation
 * surface as `parseRanges`.
 */
export function buildEveryNRanges(
  pageCount: number,
  chunkSize: number,
): { ok: true; ranges: PageRange[] } | { ok: false; error: string } {
  if (pageCount <= 0) {
    return { ok: false, error: "PDF has no pages." };
  }
  if (!Number.isFinite(chunkSize) || chunkSize < 1) {
    return { ok: false, error: "Enter a page count of at least 1." };
  }
  // Row 122: reject decimals explicitly instead of silently flooring. A user
  // typing "5.5" was previously getting 5-page chunks with no feedback, so
  // the input looked valid but didn't match the intent. Whole-number pages
  // are the only meaningful input for an every-N split.
  if (!Number.isInteger(chunkSize)) {
    return {
      ok: false,
      error: "Pages per file must be a whole number.",
    };
  }
  if (chunkSize > MAX_CHUNK_SIZE) {
    return {
      ok: false,
      error: `Page count is too large (max ${MAX_CHUNK_SIZE}).`,
    };
  }

  const size = chunkSize;
  const ranges: PageRange[] = [];

  for (let start = 1; start <= pageCount; start += size) {
    ranges.push({ start, end: Math.min(start + size - 1, pageCount) });
  }

  return { ok: true, ranges };
}

/**
 * Returns the parsed ranges for a `SplitSpec`. Centralises the
 * validation surface so the UI never has to branch on mode for error
 * handling.
 */
export function resolveSplitRanges(
  spec: SplitSpec,
  pageCount: number,
): { ok: true; ranges: PageRange[] } | { ok: false; error: string } {
  if (spec.mode === "everyN") {
    return buildEveryNRanges(pageCount, spec.chunkSize);
  }
  if (spec.ranges.length === 0) {
    return { ok: false, error: "Enter at least one page range." };
  }

  return { ok: true, ranges: spec.ranges };
}

/**
 * Sanitise the original filename for use as a download base. Strips the
 * extension, replaces any path-unsafe characters, and bounds the length so
 * the suffix we append (`-pages-3-7.pdf`) stays inside common filename
 * limits.
 */
function sanitizeFilenameBase(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const safe = base.replace(/[\\/:*?"<>|]/g, "_").trim();
  const collapsed = safe.replace(/\s+/g, " ");

  return collapsed.slice(0, 80) || "document";
}

function suffixFor(range: PageRange): string {
  return range.start === range.end
    ? `page-${range.start}`
    : `pages-${range.start}-${range.end}`;
}

/**
 * Split a PDF buffer into one PDF per range. Returns the resulting docs in
 * input order — the caller decides whether to download them individually
 * or pack into a zip via {@link buildZip}.
 *
 * Source bytes are loaded once and re-used for every copy operation, so a
 * 100-range split on a 10MB PDF doesn't re-parse the source 100 times.
 */
export async function splitPdf(
  sourceBytes: Uint8Array | ArrayBuffer,
  originalFilename: string,
  ranges: PageRange[],
): Promise<SplitResult[]> {
  const source = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: false,
  });
  const sourcePageCount = source.getPageCount();
  const base = sanitizeFilenameBase(originalFilename);
  const results: SplitResult[] = [];

  for (const range of ranges) {
    if (range.start < 1 || range.end > sourcePageCount) {
      throw new Error(
        `Range ${range.start}-${range.end} is out of bounds for a ${sourcePageCount}-page document.`,
      );
    }

    const out = await PDFDocument.create();
    const indices: number[] = [];

    for (let p = range.start; p <= range.end; p++) indices.push(p - 1);
    const copied = await out.copyPages(source, indices);

    for (const page of copied) out.addPage(page);

    const bytes = await out.save();

    results.push({
      filename: `${base}-${suffixFor(range)}.pdf`,
      bytes,
      pageRange: range,
    });
  }

  return results;
}

/**
 * Pack `SplitResult[]` into a single zip blob. JSZip is dynamically
 * imported so callers that only use {@link splitPdf} (e.g. tests, or a
 * single-range "extract" call) never pay the ~95KB cost.
 */
export async function buildZip(
  parts: SplitResult[],
  zipBaseName: string,
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const part of parts) {
    zip.file(part.filename, part.bytes);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/zip",
    comment: `Split from ${zipBaseName}`,
  });
}

/** Trigger a same-page download for a blob — anchor-click pattern. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to start the download
  // before the URL is freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
