import type { QueryClient } from "@tanstack/react-query";

import { usePendingConversionsStore } from "@/lib/client/stores/pending-conversions-store";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { logger } from "@/lib/shared/utils/logger";

let queryClientRef: QueryClient | null = null;

/**
 * QueryProvider registers the app-level QueryClient here so
 * `runPendingConversion` (which lives outside any React tree) can
 * invalidate the documents list once the background upload settles.
 * `null` on unmount so a stale client doesn't outlive HMR.
 */
export function setPendingConversionsQueryClient(
  client: QueryClient | null,
): void {
  queryClientRef = client;
}

/**
 * Uploads the original file to `POST /documents/upload` and lets the
 * backend handle the X→PDF conversion. The backend persists the source
 * mimetype in `originalContentType` on the Document row so the dashboard
 * can tell "converted" (paywalled) apart from "native PDF upload"
 * (free). Sending a pre-converted PDF would defeat that distinction —
 * do NOT re-add client-side `uploadAsPdf` here.
 *
 * Intentionally not exposed as a hook — callers fire-and-forget it from
 * the upload workspace right before navigating to `/dashboard`, and the
 * promise continues to resolve after the upload page unmounts because
 * it captures the File in closure and doesn't rely on React state.
 */
export async function runPendingConversion(
  tempId: string,
  file: File,
): Promise<void> {
  const store = usePendingConversionsStore.getState();

  try {
    store.setStatus(tempId, "uploading");
    await documentsService.uploadDocument({ file });

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
