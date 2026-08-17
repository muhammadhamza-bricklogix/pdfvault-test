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
    log("mounted, hash =", window.location.hash);
    log("window.opener present =", !!window.opener);
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
    log("writing to localStorage");
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

    log("posting message to opener");
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

    // Listen for an "ack" from the parent so we can close immediately
    // once the token has been safely received.  This avoids the race
    // where the popup closes before the parent's `storage` event fires.
    const onAck = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.source === "pdfedits-oauth-ack"
      ) {
        log("ack received from parent — closing popup now");
        try {
          window.close();
        } catch {
          // Ignore.
        }
      }
    };

    window.addEventListener("message", onAck);

    // Give both channels plenty of time to deliver before auto-closing.
    // The parent will send an ack via postMessage once it has resolved,
    // which triggers the immediate close above.  If that fails (e.g.
    // COOP severs opener) we still close after this timeout so the user
    // isn't left with a dangling blank window.
    const timer = window.setTimeout(() => {
      log("auto-closing window");
      try {
        window.close();
      } catch {
        // Ignore.
      }
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onAck);
    };
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
