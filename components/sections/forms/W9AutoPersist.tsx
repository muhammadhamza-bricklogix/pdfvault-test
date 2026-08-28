"use client";

import { useEffect } from "react";

import { savePendingW9State } from "@/lib/client/forms/pending-w9-values";
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
 * Mirrors the mutable W-9 form state (`values` + `signaturePreview`)
 * into two places on every change:
 *
 *   1. `sessionStorage` (via `savePendingW9State`). Instant, no network
 *      hop, powers the same-tab refresh restore path that
 *      `W9EditorBootstrap` reads on mount. Preview lives here as a
 *      data URL so a fresh session on remount can re-upload it and get
 *      a valid `signatureKey` without asking the user to redraw.
 *   2. The backend form session (via `formsService.patchFormSession`).
 *      Only the `values` half — the signature blob is uploaded through
 *      the dedicated `/signature` endpoint, and PATCH's `values` shape
 *      wouldn't accept it anyway. Fire-and-forget; errors are logged
 *      but never toasted, matching the "silent auto-save" contract.
 *
 * Deliberate non-features:
 *   - No toast. Auto-save is silent per user request.
 *   - No finalize call. Finalize requires a signature + is paid —
 *     PATCH keeps the partial values in the DB row without either.
 */
export function W9AutoPersist() {
  useEffect(() => {
    let localTimeout: number | null = null;
    let dbTimeout: number | null = null;
    const snap = () => {
      const s = useFormEditorStore.getState();

      return { values: s.values, signaturePreview: s.signaturePreview };
    };
    let latest = snap();

    const flushLocal = () => {
      localTimeout = null;
      savePendingW9State(latest);
    };

    const flushDb = () => {
      dbTimeout = null;
      const { sessionId } = useFormEditorStore.getState();

      if (!sessionId) return;
      formsService
        .patchFormSession(sessionId, latest.values)
        .catch((err: unknown) => {
          logger.captureError(err, "w9.auto_persist_patch", { sessionId });
        });
    };

    const unsub = useFormEditorStore.subscribe((state, prev) => {
      const valuesChanged = state.values !== prev.values;
      const previewChanged = state.signaturePreview !== prev.signaturePreview;

      if (!valuesChanged && !previewChanged) return;
      latest = snap();

      if (localTimeout === null) {
        localTimeout = window.setTimeout(flushLocal, LOCAL_DEBOUNCE_MS);
      }
      // Only PATCH when the values changed — signature isn't part of
      // the PATCH payload.
      if (valuesChanged && dbTimeout === null) {
        dbTimeout = window.setTimeout(flushDb, DB_DEBOUNCE_MS);
      }
    });

    return () => {
      unsub();
      if (localTimeout !== null) {
        window.clearTimeout(localTimeout);
        savePendingW9State(latest);
      }
      if (dbTimeout !== null) {
        window.clearTimeout(dbTimeout);
        const { sessionId } = useFormEditorStore.getState();

        if (sessionId) {
          formsService
            .patchFormSession(sessionId, latest.values)
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
