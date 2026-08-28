"use client";

import { useEffect } from "react";

import { savePendingW9Values } from "@/lib/client/forms/pending-w9-values";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

// Debounce so we're not writing sessionStorage on every keystroke —
// 400ms lands between "user tabbed to next field" (blur ≈ 0ms) and
// "user paused mid-word", which is what we want. Users don't perceive
// the delay; the write is only observable on refresh / return.
const LOCAL_DEBOUNCE_MS = 400;
// PATCH is a network hop; hold it a bit longer so a burst of typing
// coalesces into one request. Local storage still writes at 400ms so
// refresh recovery stays instant.
const DB_DEBOUNCE_MS = 1200;

/**
 * Mirrors `useFormEditorStore.values` into TWO places on every change:
 *
 *   1. `sessionStorage` (via `savePendingW9Values`). Instant, no
 *      network hop, powers the same-tab refresh restore path that
 *      `W9EditorBootstrap` reads on mount.
 *   2. The backend form session (via `formsService.patchFormSession`).
 *      Longer debounce so a burst of typing coalesces into one PATCH.
 *      Fire-and-forget — errors are logged but never toasted, matching
 *      the "silent auto-save" contract the user asked for.
 *
 * Deliberate non-features:
 *   - No toast. Auto-save is silent per user request; the save chip
 *     already surfaces document-level state for the finalized copy.
 *   - No finalize call. Finalize requires a signature + is paid —
 *     PATCH keeps the partial values in the DB row without either.
 */
export function W9AutoPersist() {
  useEffect(() => {
    let localTimeout: number | null = null;
    let dbTimeout: number | null = null;
    let latest = useFormEditorStore.getState().values;

    const flushLocal = () => {
      localTimeout = null;
      savePendingW9Values(latest);
    };

    const flushDb = () => {
      dbTimeout = null;
      const { sessionId } = useFormEditorStore.getState();

      if (!sessionId) return;
      formsService.patchFormSession(sessionId, latest).catch((err: unknown) => {
        logger.captureError(err, "w9.auto_persist_patch", { sessionId });
      });
    };

    const unsub = useFormEditorStore.subscribe((state, prev) => {
      if (state.values === prev.values) return;
      latest = state.values;

      if (localTimeout === null) {
        localTimeout = window.setTimeout(flushLocal, LOCAL_DEBOUNCE_MS);
      }
      if (dbTimeout === null) {
        dbTimeout = window.setTimeout(flushDb, DB_DEBOUNCE_MS);
      }
    });

    return () => {
      unsub();
      if (localTimeout !== null) {
        window.clearTimeout(localTimeout);
        // Sync flush on unmount so a route change doesn't drop the
        // last few keystrokes typed inside the debounce window.
        savePendingW9Values(latest);
      }
      if (dbTimeout !== null) {
        window.clearTimeout(dbTimeout);
        // Best-effort DB flush on unmount too. Failure is swallowed —
        // the local flush above already covers the same-tab reload.
        const { sessionId } = useFormEditorStore.getState();

        if (sessionId) {
          formsService
            .patchFormSession(sessionId, latest)
            .catch((err: unknown) => {
              logger.captureError(err, "w9.auto_persist_patch_unmount", {
                sessionId,
              });
            });
        }
      }
    };
  }, []);

  return null;
}
