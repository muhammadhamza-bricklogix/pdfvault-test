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
  /**
   * When set, forwarded to `POST /documents/upload` as `documentId` so
   * the backend overwrites an existing row instead of creating a new
   * one. Used by the convert-route duplicate-filename flow (QA
   * 2026-08-28: X→PDF conversion was skipping the duplicate check that
   * PDF→X had, so uploading `report.docx` with an existing `report.pdf`
   * silently created a second row).
   */
  documentId?: string,
): Promise<{ id: string; filename: string } | null> {
  const store = usePendingConversionsStore.getState();

  try {
    store.setStatus(tempId, "uploading");
    const doc = await documentsService.uploadDocument({ file, documentId });

    logger.event("upload.pending_conversion_ok", "info", {
      tempId,
      sizeBytes: file.size,
      documentId: doc.id,
    });

    store.remove(tempId);

    if (queryClientRef) {
      await queryClientRef.invalidateQueries({
        queryKey: documentKeys.lists(),
      });
    }

    // QA 2026-09-09: return the created doc so the Flow 1 caller
    // (dashboard-home mount effect) can navigate to the editor with
    // the new docId. Fire-and-forget callers can ignore the return
    // value; existing signed-in convert-route callers do exactly that.
    return { id: doc.id, filename: doc.filename };
  } catch (err) {
    logger.captureError(err, "upload.pending_conversion", { tempId });
    store.setStatus(
      tempId,
      "error",
      err instanceof Error ? err.message : "Conversion failed",
    );

    return null;
  }
}
