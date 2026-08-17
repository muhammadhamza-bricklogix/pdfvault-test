"use client";

import type { StartUploadInput, StartUploadResult } from "./use-tracked-upload";
import type { Document } from "@/lib/shared/types/documents.types";

import { useCallback, useState } from "react";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import {
  formatFileSize,
  MAX_UPLOAD_BYTES,
} from "@/lib/shared/utils/file-upload.utils";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

import { useTrackedUpload } from "./use-tracked-upload";

const DUPLICATE_CHECK_PAGE_SIZE = 100;
const DUPLICATE_CHECK_MAX_PAGES = 10;

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
 * Walk the user's documents list looking for an exact filename match.
 * Exported so non-tracked-upload paths (cloud picker, etc.) can run the
 * same duplicate-name guard without depending on the upload hook.
 */
export async function findDuplicateByFilename(
  filename: string,
): Promise<Document | null> {
  for (let page = 1; page <= DUPLICATE_CHECK_MAX_PAGES; page += 1) {
    const response = await documentsService.listDocuments({
      page,
      pageSize: DUPLICATE_CHECK_PAGE_SIZE,
    });
    const match = response.items.find((d) => d.filename === filename);

    if (match) return match;
    if (page >= response.pagination.totalPages) return null;
  }

  return null;
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
