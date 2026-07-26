"use client";

import { useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

/**
 * Wipes the in-memory editor store on landing-home mount.
 *
 * Without this, a signed-out user who opens the composer via one tool tile,
 * drops a file, then navigates back to the landing page (logo / nav / back
 * button) still has the previous PDF sitting in Zustand. The next tool tile
 * click sends them to `/pdf-composer?fresh=1&tool=X`; the hydrator's
 * `clearFile()` only fires AFTER `authLoaded`, so the first render paints
 * `<EditorLayout />` with the stale file and `usePdfLoader` re-parses it
 * behind `<EditorLoadingShell />` — the "stuck on infinite loader" report.
 *
 * Clearing at landing-mount guarantees the store is empty by the time the
 * user picks the next tool, matching the "fresh start every tool click"
 * behavior the tool tiles already imply via `?fresh=1`.
 */
export function LandingFreshStart() {
  useEffect(() => {
    usePdfEditorStore.getState().clearFile();
  }, []);

  return null;
}
