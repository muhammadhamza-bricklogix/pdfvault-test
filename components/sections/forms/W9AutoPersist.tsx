"use client";

import { useEffect } from "react";

import { savePendingW9State } from "@/lib/client/forms/pending-w9-values";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

// Debounce so we're not writing localStorage on every keystroke —
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
 *   1. `localStorage` (via `savePendingW9State`). Instant, no network
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
 * Persistence guarantees:
 *   - Debounced writes on every field change (400ms local, 1200ms DB).
 *   - Unconditional sync flush on component unmount so a route change
 *     (logo click, hamburger → My PDFs, Back button, etc.) never drops
 *     the last change — even if the debounce hadn't fired yet.
 *   - `pagehide` listener so a hard navigation (browser close, address-
 *     bar navigation, iOS Safari swipe-back) also flushes before the
 *     document is discarded. `pagehide` fires reliably where
 *     `beforeunload` doesn't on mobile.
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

    const flushLocalNow = () => {
      if (localTimeout !== null) {
        window.clearTimeout(localTimeout);
        localTimeout = null;
      }
      savePendingW9State(latest);
    };

    const flushDbNow = () => {
      if (dbTimeout !== null) {
        window.clearTimeout(dbTimeout);
        dbTimeout = null;
      }
      const { sessionId } = useFormEditorStore.getState();

      if (!sessionId) return;
      formsService
        .patchFormSession(sessionId, latest.values)
        .catch((err: unknown) => {
          logger.captureError(err, "w9.auto_persist_patch", { sessionId });
        });
    };

    const flushLocalDebounced = () => {
      localTimeout = null;
      savePendingW9State(latest);
    };

    const flushDbDebounced = () => {
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
        localTimeout = window.setTimeout(
          flushLocalDebounced,
          LOCAL_DEBOUNCE_MS,
        );
      }
      // Only PATCH when the values changed — signature isn't part of
      // the PATCH payload.
      if (valuesChanged && dbTimeout === null) {
        dbTimeout = window.setTimeout(flushDbDebounced, DB_DEBOUNCE_MS);
      }
    });

    // pagehide fires on hard navigations (URL bar, tab close, iOS
    // back-gesture) where React cleanup may not run in time. Sync
    // localStorage write only — the DB PATCH is async and would be
    // aborted by the navigation anyway; the local mirror is the one
    // that has to be atomic here.
    const onPageHide = () => {
      latest = snap();
      savePendingW9State(latest);
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      unsub();
      window.removeEventListener("pagehide", onPageHide);
      // ALWAYS flush on unmount, not just when a debounce is pending.
      // The user's typed values may already be in localStorage from a
      // prior debounced flush, but flushing again is idempotent and
      // covers the edge case where the store received updates via a
      // code path other than subscribe (external `useFormEditorStore
      // .setState` calls). Cheap safety net.
      latest = snap();
      flushLocalNow();
      flushDbNow();
    };
  }, []);

  return null;
}
