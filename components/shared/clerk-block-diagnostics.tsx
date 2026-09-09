"use client";

import { useEffect } from "react";

import { logger } from "@/lib/shared/utils/logger";

/**
 * Post-CookieYes-rejection diagnostic. Runs once ~4s after mount and ships
 * a snapshot to CloudWatch showing whether Clerk's script + cookies survived
 * CookieYes' auto-blocker. Signal fields:
 *
 *   clerkScriptTagCount   — number of <script src="…clerk…"> tags in DOM
 *   clerkScriptTagsBlocked — how many of those have type="text/plain"
 *                            (= CookieYes wrapped them to defer execution)
 *   windowClerkPresent    — did window.Clerk get defined (script executed)
 *   clerkCookiesPresent   — count of __client / __session / __clerk_* cookies
 *                            actually visible via document.cookie
 *   cookieyesLoaded       — did CookieYes' own script initialize
 *   cookieyesConsent      — CKY_CONSENT cookie value if present (necessary /
 *                            all / rejected)
 *
 * Fires as `diag.cookie_gate` — grep CloudWatch to see the population that
 * has script tags but no Clerk cookies (= consent-gated auth failure).
 * Runs client-side only, once per page load. No PII.
 */
export function ClerkBlockDiagnostics(): null {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const clerkScripts = Array.from(
          document.querySelectorAll<HTMLScriptElement>(
            'script[src*="clerk"], script[src*="clerk.pdfvault.ai"]',
          ),
        );
        const blockedScripts = clerkScripts.filter(
          (s) => s.type === "text/plain",
        );
        const cookieString = document.cookie;
        const clerkCookieNames = cookieString
          .split(";")
          .map((c) => c.trim().split("=")[0])
          .filter(
            (name) =>
              name === "__client" ||
              name === "__session" ||
              name.startsWith("__client_") ||
              name.startsWith("__session_") ||
              name.startsWith("__clerk_"),
          );
        const cookieYesConsent =
          cookieString
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("cookieyes-consent="))
            ?.slice("cookieyes-consent=".length) ?? null;
        const cookieYesLoaded =
          typeof (window as unknown as { CookieYes?: unknown }).CookieYes !==
            "undefined" ||
          typeof (window as unknown as { CookieYesAPI?: unknown })
            .CookieYesAPI !== "undefined" ||
          document.getElementById("cookieyes") !== null;
        const windowClerkPresent =
          typeof (window as unknown as { Clerk?: unknown }).Clerk !==
          "undefined";

        logger.event("diag.cookie_gate", "info", {
          clerkScriptTagCount: clerkScripts.length,
          clerkScriptTagsBlocked: blockedScripts.length,
          clerkScriptSrcs: clerkScripts.map((s) => s.src).slice(0, 5),
          windowClerkPresent,
          clerkCookiesPresent: clerkCookieNames.length,
          clerkCookieNames,
          cookieyesLoaded: cookieYesLoaded,
          cookieyesConsent: cookieYesConsent,
        });
      } catch {
        // Diagnostic must never break rendering — swallow any DOM access
        // failure silently.
      }
    }, 4000);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
