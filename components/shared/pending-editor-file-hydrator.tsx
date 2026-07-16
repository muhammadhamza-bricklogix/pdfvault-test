"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Rehydrates a File the landing UploadWorkspace stashed in IndexedDB
 * just before Clerk bounced a signed-out visitor through sign-in. Runs
 * once on `/pdf-composer` mount.
 *
 * Flow (post-signin):
 *   1. Read the pending File from IDB.
 *   2. Upload it to the user's library via /documents/upload so it
 *      persists (Dashboard → My PDFs shows it) even if they leave the
 *      editor and come back. Subsequent editor saves overwrite this
 *      same document rather than creating a duplicate.
 *   3. Push the returned Document + local File blob into the editor
 *      store so the editor can render immediately without waiting for
 *      the round-trip through the server.
 *   4. Clear the IDB marker + invalidate the docs list query so the
 *      Dashboard reflects the new row on next visit.
 *
 * If the store already holds a fresh in-tab file (user opened another
 * PDF while this was still queued), the IDB record is dropped as stale
 * and no upload happens.
 *
 * Lives outside `components/sections/pdf-editor/**` so the rehydrate
 * seam doesn't touch the locked editor internals.
 */
export function PendingEditorFileHydrator() {
  const ranRef = useRef(false);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const currentFile = usePdfEditorStore((s) => s.file);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const file = await loadPendingEditorFile();

        if (cancelled || !file) return;
        if (currentFile) {
          await clearPendingEditorFile();

          return;
        }

        // Save first (persist to the user's library), then open. Uses a
        // dismissable loading toast so the user knows something is
        // happening on slow uploads.
        const loadingKey = toast.loading({
          title: "Saving your PDF…",
          description: file.name,
        });

        try {
          const document = await documentsService.uploadDocument({ file });

          if (cancelled) return;
          setCurrentDocument({ id: document.id, name: document.filename });
          setFile(file);
          queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
          toast.success({
            title: "Saved to My PDFs",
            description: document.filename,
          });
        } catch (err) {
          logger.warn("pending editor file save failed", err);
          if (cancelled) return;
          // Fall back to open-only so the user isn't stranded — they can
          // still edit and Save from the editor to persist manually.
          setCurrentDocument(null);
          setFile(file);
          toast.error({
            title: "Couldn't save automatically",
            description: "Your file opened locally. Use Save to store it.",
          });
        } finally {
          toast.close(loadingKey);
          await clearPendingEditorFile();
        }
      } catch (err) {
        logger.warn("pending editor file hydrate failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentFile, queryClient, setCurrentDocument, setFile]);

  return null;
}
