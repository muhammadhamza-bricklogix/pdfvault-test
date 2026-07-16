"use client";

import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { logger } from "@/lib/shared/utils/logger";

/**
 * Rehydrates a File the landing UploadWorkspace stashed in IndexedDB
 * just before Clerk bounced a signed-out visitor through sign-in. Runs
 * once on `/pdf-composer` mount — if the editor store already holds a
 * file (fresh in-tab upload), the IDB record is dropped as stale;
 * otherwise we load it, push it into the store, and clear the marker.
 *
 * Deliberately lives outside `components/sections/pdf-editor/**` so the
 * rehydrate seam doesn't touch the locked editor internals.
 */
export function PendingEditorFileHydrator() {
  const ranRef = useRef(false);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const currentFile = usePdfEditorStore((s) => s.file);

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
        setCurrentDocument(null);
        setFile(file);
        await clearPendingEditorFile();
      } catch (err) {
        logger.warn("pending editor file hydrate failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentFile, setCurrentDocument, setFile]);

  return null;
}
