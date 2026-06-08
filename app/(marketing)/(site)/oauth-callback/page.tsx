"use client";

import { useEffect } from "react";

/**
 * OAuth implicit-flow callback for the Google Drive / OneDrive pickers.
 *
 * Google / Microsoft redirect here after the user authorises the app. We
 * parse `access_token` / `state` (Google uses URL hash, Microsoft uses
 * `response_mode=fragment` which is also hash), forward them to the
 * opener window via `postMessage`, then close ourselves.
 *
 * Why a dedicated page (was `${origin}/`):
 *   - The previous polling-based flow read `popup.location.href` from the
 *     parent. Modern browsers block that under `Cross-Origin-Opener-Policy`
 *     (the console error chain "COOP policy would block the window.closed
 *     call"), so the parent never saw the redirect.
 *   - `postMessage` from the (same-origin) callback back to the opener
 *     works under strict COOP because both windows agree on the origin.
 *
 * Whitelisting required:
 *   - Google Cloud Console → OAuth client → Authorized redirect URIs:
 *     add `${origin}/oauth-callback` (replace the old `${origin}/` entry).
 *   - Azure Portal → App registration → Authentication → Redirect URIs:
 *     same addition for OneDrive.
 */
const isDev = process.env.NODE_ENV !== "production";

const log = (...args: unknown[]) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[oauth-callback]", ...args);
  }
};

export default function OAuthCallbackPage() {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[oauth-callback] page mounted, hash:", window.location.hash);
    // eslint-disable-next-line no-console
    console.log("[oauth-callback] window.opener:", !!window.opener);
    log("mounted, location =", window.location.href);

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);

    const payload = {
      accessToken: hash.get("access_token") ?? query.get("access_token"),
      error: hash.get("error") ?? query.get("error"),
      errorDescription:
        hash.get("error_description") ?? query.get("error_description"),
      source: "pdfedits-oauth" as const,
      state: hash.get("state") ?? query.get("state"),
    };

    log("parsed payload", {
      accessToken: payload.accessToken ? "present" : null,
      error: payload.error,
      state: payload.state ? "present" : null,
    });

    // Hand the payload off to the parent via TWO channels:
    //   1. `postMessage` — fastest path. Works only when `window.opener`
    //      survived the cross-origin OAuth navigation (requires
    //      `Cross-Origin-Opener-Policy: same-origin-allow-popups` on the
    //      main app — set in `next.config.mjs`).
    //   2. `localStorage` fallback — fires the `storage` event in the
    //      opener window even when COOP severed the opener pointer (which
    //      is the default `same-origin` behaviour and what most hosts
    //      ship). Either channel resolves the parent's promise.
    // eslint-disable-next-line no-console
    console.log("[oauth-callback] writing to localStorage");
    try {
      window.localStorage.setItem(
        "pdfedits:oauth-result",
        JSON.stringify({ ...payload, ts: Date.now() }),
      );
      log("storage write OK");
    } catch (err) {
      log("storage write failed", err);
    }

    log("window.opener =", Boolean(window.opener));

    // eslint-disable-next-line no-console
    console.log("[oauth-callback] posting message to opener");
    if (window.opener) {
      try {
        window.opener.postMessage(payload, window.location.origin);
        log("postMessage sent");
      } catch (err) {
        log("postMessage threw", err);
      }
    } else {
      log("postMessage skipped (no opener) — storage fallback should fire");
    }

    // Give both channels a tick to deliver, then close. Some browsers
    // refuse `window.close()` when the popup wasn't opened by script;
    // wrap in try/catch.
    const timer = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log("[oauth-callback] closing window");
      try {
        window.close();
      } catch {
        // Ignore.
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm font-medium text-[var(--color-foreground)]">
        Completing sign-in…
      </p>
      <p className="text-xs text-default-500">You can close this window.</p>
    </div>
  );
}
