"use client";

import { useSyncExternalStore } from "react";

/**
 * Lightweight client-side signed-in detector for landing / marketing /
 * legal routes — reads Clerk's `__client_uat` cookie via `document.cookie`.
 *
 * `__client_uat` is Clerk's Client User Authentication Timestamp cookie,
 * documented in `@clerk/backend/dist/constants.d.ts`. It is NOT HTTP-only
 * (unlike `__session`), so JS can read it without loading the Clerk SDK.
 * Value `"0"` (or absent) = signed-out. Any non-zero string = signed-in.
 *
 * Returns the SAME shape as `useAuth()` from `@clerk/nextjs`, so it can
 * be dropped in wherever landing components previously called `useAuth()`
 * for read-only signed-in state. Zero Clerk JS ships to routes that only
 * need this hint.
 *
 * WHAT THIS IS NOT: a verified auth check.
 *   - Session validity is enforced by the Clerk middleware / server
 *     helpers on protected routes.
 *   - If the cookie is momentarily stale (session revoked but cookie not
 *     yet cleared), a signed-out user could briefly see the signed-in
 *     header variant until the next protected-route request clears it.
 *     Acceptable on marketing surfaces; do NOT use this hook to gate
 *     anything security-sensitive.
 *
 * Uses `useSyncExternalStore` (React 18+) instead of `useEffect` + setState
 * so we comply with the repo's `react-hooks/set-state-in-effect` lint rule
 * and get automatic SSR-safe hydration behaviour: the SSR snapshot returns
 * `{ isLoaded: false, isSignedIn: false }` matching what the previous
 * `useAuth()` first-render also returned, then flips to the real value
 * on the client without a cascading render.
 */
type AuthHint = { isLoaded: boolean; isSignedIn: boolean };

const SIGNED_OUT_HINT: AuthHint = { isLoaded: false, isSignedIn: false };

function readCookieHint(): AuthHint {
  if (typeof document === "undefined") return SIGNED_OUT_HINT;
  const match = document.cookie.match(/(?:^|;\s*)__client_uat=([^;]*)/);
  const raw = match ? decodeURIComponent(match[1]) : "";
  const isSignedIn = raw !== "" && raw !== "0";

  return { isLoaded: true, isSignedIn };
}

// Cache the hint object between reads with matching values. `useSync-
// ExternalStore` requires stable identity to skip re-renders; recomputing
// `readCookieHint()` on every subscription tick would produce a fresh
// object with matching fields and trigger an infinite render loop.
let cached: AuthHint = SIGNED_OUT_HINT;

function getSnapshot(): AuthHint {
  const next = readCookieHint();

  if (
    next.isLoaded !== cached.isLoaded ||
    next.isSignedIn !== cached.isSignedIn
  ) {
    cached = next;
  }

  return cached;
}

function getServerSnapshot(): AuthHint {
  return SIGNED_OUT_HINT;
}

function subscribe(onStoreChange: () => void): () => void {
  // Cookies don't fire change events, but the auth state realistically
  // only flips when the user navigates back to a Clerk-instrumented route
  // (sign-in / sign-up / sign-out) — the resulting `visibilitychange`
  // when the tab regains focus is a good enough re-read trigger. Cheap
  // and covers the "user signed in another tab" case.
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("visibilitychange", onStoreChange);
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.removeEventListener("visibilitychange", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
}

export function useClientAuthHint(): AuthHint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
