"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";

/**
 * Auto-persist for signed-out editor sessions.
 *
 * A signed-out user can upload a PDF, edit it, then navigate to sign up
 * via ANY path — the export-flow prompt (has redirect_url + explicit
 * snapshot), the site navbar's "Sign up" button (client-side
 * `router.push`, no pagehide), an out-of-app Clerk link, or a plain tab
 * close. If we only snapshot on `pagehide`, SPA navigations lose the
 * work (pagehide doesn't fire for client-side routing) → on return the
 * hydrator's IDB probe comes back empty → drop-zone shown → user's
 * file + edits are gone.
 *
 * This hook covers the whole surface by writing to IDB proactively:
 *
 *   1. **On file set** — the moment a signed-out user drops a PDF, mirror
 *      it into IDB so navigating away IMMEDIATELY (before any edit)
 *      still preserves the file.
 *
 *   2. **On edit** — subscribe to `hasUnsavedChanges` flipping true and
 *      re-snapshot with the latest fabric overlays / extractedPages.
 *      Debounced so a rapid-fire drawing gesture doesn't hammer IDB.
 *
 *   3. **On pagehide / visibilitychange** — kept as belt-and-braces for
 *      the edge case where an edit is in-flight when the browser tears
 *      the page down (mainly iOS Safari tab-eviction).
 *
 * Only active while `isSignedIn === false`. Signed-in users have their
 * edits round-tripping through `/documents/upload` so IDB shadowing is
 * unnecessary (and would race the cloud save on the sign-in transition).
 */
const IDLE_DEBOUNCE_MS = 800;

export function useSignedOutAutoPersist(fabricCanvas: FabricCanvas | null) {
  // Read auth from Clerk directly — the store's `isSignedIn` mirror lags
  // one tick during the post-signin return (auth chain invariant 1).
  // Reading the store here would keep the hook armed briefly after
  // sign-in and could snapshot an unrelated file into IDB for the
  // signed-in user. Clerk's hook is the source of truth.
  const { isSignedIn } = useAuth();
  const file = usePdfEditorStore((s) => s.file);
  const hasUnsavedChanges = usePdfEditorStore((s) => s.hasUnsavedChanges);

  const fabricRef = useRef(fabricCanvas);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    if (isSignedIn) return;
    if (!file) return;
    if (typeof document === "undefined") return;

    const persist = () => {
      // Fire-and-forget on unload paths — IDB writes are a few ms and
      // the browser gives unload handlers a short async budget.
      void snapshotPendingEditorFile(fabricRef.current).catch(() => undefined);
    };

    // Kick off an immediate snapshot for the current file. Handles the
    // "user drops a PDF then clicks the navbar Sign up before making any
    // edit" case — pagehide alone wouldn't fire for a router.push nav.
    persist();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [file, isSignedIn]);

  // Debounced edit snapshot. `hasUnsavedChanges` flips true on every
  // meaningful edit — schedule a snapshot ~800ms later so a rapid drag
  // (draw, highlight, shape) coalesces into a single IDB write instead
  // of one write per Fabric event. Signed-out only; signed-in flows
  // upload to the cloud via the normal save path.
  useEffect(() => {
    if (isSignedIn) return;
    if (!file) return;
    if (!hasUnsavedChanges) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void snapshotPendingEditorFile(fabricRef.current).catch(() => undefined);
      debounceTimerRef.current = null;
    }, IDLE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [file, hasUnsavedChanges, isSignedIn]);
}
