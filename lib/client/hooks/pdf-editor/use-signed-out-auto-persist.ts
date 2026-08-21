"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";

/**
 * Belt-and-braces auto-persist for signed-out editor sessions.
 *
 * Every in-editor sign-in path now snapshots the working file + fabric
 * overlays + extractedPages to IndexedDB before dispatching the sign-in
 * prompt (see `snapshotPendingEditorFile`). This hook is the safety net
 * for the paths we don't explicitly own — the user typing `/sign-in`
 * into the URL bar, clicking a Clerk link, closing the tab and coming
 * back, or triggering any navigation the editor can't intercept.
 *
 * When the page is being hidden (`pagehide` fires most reliably on
 * iOS Safari, `visibilitychange` on desktop) and the store has a file
 * loaded, we snapshot the current state so the hydrator's post-signin
 * restore path (or the normal rehydrate path on plain return) has
 * something to bring back.
 *
 * Only active while `isSignedIn === false` — signed-in users don't
 * need this because their edits already round-trip through
 * `/documents/upload`.
 */
export function useSignedOutAutoPersist(fabricCanvas: FabricCanvas | null) {
  // Read auth from Clerk directly — the store's `isSignedIn` mirror lags
  // one tick during the post-signin return (auth chain invariant 1).
  // Reading the store here would keep the hook armed briefly after
  // sign-in and could snapshot an unrelated file into IDB for the
  // signed-in user. Clerk's hook is the source of truth.
  const { isSignedIn } = useAuth();
  const file = usePdfEditorStore((s) => s.file);

  const fabricRef = useRef(fabricCanvas);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    if (isSignedIn) return;
    if (!file) return;
    if (typeof document === "undefined") return;

    const persist = () => {
      // Fire-and-forget. IDB writes are a few ms; the browser gives
      // pagehide handlers a short async budget on both Safari and
      // Chromium. Awaiting isn't possible without blocking the
      // unload.
      void snapshotPendingEditorFile(fabricRef.current).catch(() => undefined);
    };

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
}
