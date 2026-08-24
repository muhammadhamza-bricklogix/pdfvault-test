import type { QueryClient } from "@tanstack/react-query";

import { isPdf, uploadAsPdf } from "@/lib/client/file-conversion/upload-to-pdf";
import { usePendingConversionsStore } from "@/lib/client/stores/pending-conversions-store";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { logger } from "@/lib/shared/utils/logger";

let queryClientRef: QueryClient | null = null;

/**
 * QueryProvider registers the app-level QueryClient here so
 * `runPendingConversion` (which lives outside any React tree) can
 * invalidate the documents list once the background convert + upload
 * settles. `null` on unmount so a stale client doesn't outlive HMR.
 */
export function setPendingConversionsQueryClient(
  client: QueryClient | null,
): void {
  queryClientRef = client;
}

/**
 * Runs the convert-to-PDF + save pipeline for one pending item, updating
 * the Zustand store's status as it progresses. Intentionally not exposed
 * as a hook — callers fire-and-forget it from the upload workspace
 * right before navigating to `/dashboard`, and the promise continues to
 * resolve after the upload page unmounts because it captures the File
 * in closure and doesn't rely on React state.
 */
export async function runPendingConversion(
  tempId: string,
  file: File,
): Promise<void> {
  const store = usePendingConversionsStore.getState();

  try {
    store.setStatus(tempId, "converting");
    const pdfFile = isPdf(file) ? file : await uploadAsPdf(file);

    store.setStatus(tempId, "uploading");
    await documentsService.uploadDocument({ file: pdfFile });

    logger.event("upload.pending_conversion_ok", "info", {
      tempId,
      sizeBytes: file.size,
    });

    store.remove(tempId);

    if (queryClientRef) {
      await queryClientRef.invalidateQueries({
        queryKey: documentKeys.lists(),
      });
    }
  } catch (err) {
    logger.captureError(err, "upload.pending_conversion", { tempId });
    store.setStatus(
      tempId,
      "error",
      err instanceof Error ? err.message : "Conversion failed",
    );
  }
}
