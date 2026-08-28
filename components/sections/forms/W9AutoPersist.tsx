"use client";

import { useEffect } from "react";

import { savePendingW9Values } from "@/lib/client/forms/pending-w9-values";
import { useFormEditorStore } from "@/lib/client/stores";

// Debounce so we're not writing sessionStorage on every keystroke —
// 400ms lands between "user tabbed to next field" (blur ≈ 0ms) and
// "user paused mid-word", which is what we want. Users don't perceive
// the delay; the write is only observable on refresh / return.
const PERSIST_DEBOUNCE_MS = 400;

/**
 * Silently mirrors `useFormEditorStore.values` into `sessionStorage`
 * via `savePendingW9Values` so a refresh, tab restore, or sign-in
 * bounce never loses in-progress typing. `W9EditorBootstrap` already
 * reads those pending values on mount and merges them into the store
 * (see `readPendingW9Values` there) — this component closes the write
 * side of the loop.
 *
 * Deliberate non-features:
 *   - No toast. User asked for silent auto-save; the save chip already
 *     communicates document-level state for the finalized copy.
 *   - No backend hit. The finalize endpoint requires a fully valid
 *     form + is a paid action; partial saves have to stay client-side
 *     until the backend grows an explicit `PATCH /form-sessions/:id`.
 *   - No clearing here. `W9EditorBootstrap` clears after successful
 *     restore; keeping partials past a fresh mount is intentional so
 *     the user can close the tab and come back later.
 */
export function W9AutoPersist() {
  useEffect(() => {
    let timeout: number | null = null;
    let latest = useFormEditorStore.getState().values;

    const flush = () => {
      timeout = null;
      savePendingW9Values(latest);
    };

    const unsub = useFormEditorStore.subscribe((state, prev) => {
      if (state.values === prev.values) return;
      latest = state.values;
      if (timeout !== null) return;
      timeout = window.setTimeout(flush, PERSIST_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timeout !== null) {
        window.clearTimeout(timeout);
        // Sync flush on unmount so a route change doesn't drop the
        // last few keystrokes typed inside the debounce window.
        savePendingW9Values(latest);
      }
    };
  }, []);

  return null;
}
