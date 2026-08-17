"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

// `useSyncExternalStore` requires a server snapshot too. We always claim
// "online" on the server so the SSR HTML matches the most common runtime
// state — the banner / cache logic only matters once we're in the browser.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Tracks the browser's online/offline status without a cascading-render
 * effect (the React-blessed pattern for subscribing to external browser
 * APIs). Returns `true` during SSR; client-side, kept in sync with
 * `navigator.onLine` via the `online` / `offline` window events.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
