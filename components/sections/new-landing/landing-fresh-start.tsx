"use client";

import { useEffect } from "react";

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
 * PERF (2026-08-30): the store module is 935+ lines and drags in Fabric
 * type imports + pdf.js types. Importing it synchronously on the landing
 * page was adding ~40 KB to the initial landing bundle for a one-line
 * `.clearFile()` call. Now dynamically imported and deferred to
 * `requestIdleCallback` (or 1.5s fallback) — the store loads AFTER
 * landing LCP + user-visible content, and the clear runs from a chunk
 * that's cached for subsequent composer visits anyway.
 */
export function LandingFreshStart() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    console.log("[PDFedits-i18n] LandingFreshStart mount", {
      pathname: location.pathname,
      langPref: document.cookie.match(/lang_pref=(\w+)/)?.[1] ?? null,
    });
    let cancelled = false;
    // Capture the file reference at mount time. We only clear if the
    // store STILL holds that same reference when the deferred callback
    // fires — otherwise a fresh upload set a new File between mount and
    // the ric firing, and clearing it would wipe the user's just-
    // uploaded PDF. Symptom: on `/de/` (or any locale landing), user
    // uploads → composer starts loading → `LandingFreshStart` ric fires
    // during the route transition → `clearFile()` runs → composer shell
    // sees `file=null` and redirects the signed-out user to `/` (which
    // middleware routes back to `/de/`). QA 2026-09-23.
    let originalFile: unknown = null;
    const run = () => {
      if (cancelled) return;
      void import("@/lib/client/stores").then((m) => {
        if (cancelled) return;
        const currentFile = m.usePdfEditorStore.getState().file;

        // Race guard: if the file was replaced or set after mount, do
        // not clear it. The user is mid-upload flow and their new file
        // must survive the route change.
        if (currentFile !== originalFile) return;
        if (currentFile === null) return; // nothing to clear anyway
        m.usePdfEditorStore.getState().clearFile();
      });
    };

    // Snapshot the file reference synchronously via a lightweight
    // dynamic import — same chunk the run() uses, so this is a cheap
    // no-op on the second call. Keeps `originalFile` accurate even if
    // the store loads after mount.
    void import("@/lib/client/stores").then((m) => {
      if (cancelled) return;
      originalFile = m.usePdfEditorStore.getState().file;
    });
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    const cic = (
      window as unknown as {
        cancelIdleCallback?: (handle: number) => void;
      }
    ).cancelIdleCallback;
    const handle = ric ? ric(run) : window.setTimeout(run, 1500);

    return () => {
      cancelled = true;
      if (ric && cic) cic(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return null;
}
