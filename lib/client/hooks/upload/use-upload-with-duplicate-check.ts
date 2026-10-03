"use client";

import type { StartUploadInput, StartUploadResult } from "./use-tracked-upload";
import type { Document } from "@/lib/shared/types/documents.types";

import { useCallback, useState } from "react";

import { loadLibraryIndex } from "@/lib/client/documents/library-filename-index";
import {
  formatFileSize,
  MAX_UPLOAD_BYTES,
} from "@/lib/shared/utils/file-upload.utils";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

import { useTrackedUpload } from "./use-tracked-upload";

type PendingUpload = {
  input: StartUploadInput;
  existing: Document;
};

export type DuplicatePrompt = {
  filename: string;
  onIgnore: () => void;
  onOverwrite: () => void;
};

/**
 * Look up an exact (case-insensitive) filename in the user's library.
 * Backed by the shared cached index so a Save does not re-walk the whole
 * library for every question it needs answered.
 */
export async function findDuplicateByFilename(
  filename: string,
): Promise<Document | null> {
  const index = await loadLibraryIndex();

  return index.get(filename.toLowerCase()) ?? null;
}

/** Trailing " (2)" / " (17)" on a base name, so numbering never stacks. */
const COUNTER_SUFFIX = /\s\((\d+)\)$/;

/**
 * First free name at or after `desired`, e.g. `IRS Form W-9.pdf` ->
 * `IRS Form W-9 (2).pdf`. Returns `desired` unchanged when it is free.
 *
 * Fetches the library once and scans in memory rather than probing each
 * candidate over the network, and strips any existing " (n)" so a second
 * pass yields "(3)" rather than "(2) (2)".
 */
export async function nextAvailableFilename(desired: string): Promise<string> {
  const index = await loadLibraryIndex();
  const taken = new Set(index.keys());

  if (!taken.has(desired.toLowerCase())) return desired;

  // `lastIndexOf` rather than a regex so "v1.2 report.pdf" keeps its dots.
  const dot = desired.lastIndexOf(".");
  const hasExt = dot > 0;
  const ext = hasExt ? desired.slice(dot) : "";
  const base = (hasExt ? desired.slice(0, dot) : desired).replace(
    COUNTER_SUFFIX,
    "",
  );

  for (let n = 2; n <= 999; n += 1) {
    const candidate = `${base} (${n})${ext}`;

    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  // Unreachable in practice — 998 same-named files. Still never collide.
  return `${base} (${Date.now()})${ext}`;
}

export function useUploadWithDuplicateCheck() {
  const { start: baseStart } = useTrackedUpload();
  const [pending, setPending] = useState<PendingUpload | null>(null);

  const start = useCallback(
    async (input: StartUploadInput): Promise<StartUploadResult | null> => {
      // Hard size cap, enforced client-side before kicking off any
      // network work. Without this the user sees a multi-minute upload
      // bar that eventually fails at the backend's request-size limit;
      // the immediate toast is much better feedback. Constant lives in
      // `file-upload.utils.ts` so the editor drop-zone uses the same
      // ceiling.
      if (input.file.size > MAX_UPLOAD_BYTES) {
        toast.error({
          title: "File too large",
          description: `"${input.file.name}" is ${formatFileSize(input.file.size)}. The limit is ${formatFileSize(MAX_UPLOAD_BYTES)}.`,
        });

        return null;
      }

      // Re-uploads to an existing document skip the duplicate check — the
      // caller is intentionally targeting that document.
      if (input.documentId) {
        return baseStart(input);
      }

      try {
        const existing = await findDuplicateByFilename(input.file.name);

        if (existing) {
          setPending({ existing, input });

          return null;
        }
      } catch (err) {
        // If the check fails (network, auth), fall through to the upload so
        // the user isn't blocked by a transient lookup error.
        logger.error("Duplicate-name check failed", err);
      }

      return baseStart(input);
    },
    [baseStart],
  );

  const handleOverwrite = useCallback(() => {
    if (!pending) return;
    void baseStart({ ...pending.input, documentId: pending.existing.id });
    setPending(null);
  }, [baseStart, pending]);

  const handleIgnore = useCallback(() => {
    setPending(null);
  }, []);

  const duplicate: DuplicatePrompt | null = pending
    ? {
        filename: pending.existing.filename,
        onIgnore: handleIgnore,
        onOverwrite: handleOverwrite,
      }
    : null;

  return { duplicate, start };
}

export type UseUploadWithDuplicateCheck = ReturnType<
  typeof useUploadWithDuplicateCheck
>;
