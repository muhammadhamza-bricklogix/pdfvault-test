/**
 * CookieYes consent gate helpers.
 *
 * CookieYes' dashboard-side auto-blocker wraps script tags whose source
 * domain isn't registered under a Necessary cookie's Script URL Pattern
 * with `type="text/plain"`, so those scripts never execute. When the
 * blocked script is Clerk, no session cookies are ever set and every
 * authenticated request (Save, Download, Share, Merge upload) fails.
 *
 * These helpers detect the block on the client so the editor can surface
 * a targeted "Cookies blocking save" toast instead of a generic
 * "Could not save" error that leaves the user with no path forward.
 *
 * Client-only. All helpers return `false` in SSR / non-browser envs.
 */

const COOKIE_NAME = "cookieyes-consent";
const COOKIEYES_SCRIPT_ID = "cookieyes";

function readConsentCookieRaw(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));

    if (!raw) return null;

    return decodeURIComponent(raw.slice(`${COOKIE_NAME}=`.length));
  } catch {
    return null;
  }
}

/**
 * True when CookieYes' script tag is present in the DOM. Signals the
 * auto-blocker is live regardless of consent state.
 */
export function isCookieYesLoaded(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.getElementById(COOKIEYES_SCRIPT_ID) !== null;
  } catch {
    return false;
  }
}

/**
 * True when the user has actively rejected at least one non-necessary
 * category. Value format is a URL-encoded, colon/comma-delimited string
 * like `consentid:...,consent:{necessary:yes,functional:no,analytics:no,...}`
 * — a substring match on any `:no` is enough to detect a rejection.
 */
export function hasCookieYesRejection(): boolean {
  const raw = readConsentCookieRaw();

  if (!raw) return false;

  return /:no\b/.test(raw);
}

/**
 * True when CookieYes is loaded but the user hasn't made a decision yet
 * (no consent cookie set). Under GDPR mode CookieYes treats "no decision"
 * as rejection — the auto-blocker keeps every non-necessary script wrapped
 * in `type="text/plain"`, which includes Clerk when its script URL isn't
 * mapped to a Necessary cookie.
 */
export function isCookieYesConsentUnset(): boolean {
  if (!isCookieYesLoaded()) return false;

  return readConsentCookieRaw() === null;
}

/**
 * True when Clerk's runtime object never became available AND CookieYes
 * is loaded — the strongest single signal that the auto-blocker is
 * gating Clerk's boot script. Uses `window.Clerk` because Clerk's SDK
 * assigns it during initialization; if the script tag was wrapped with
 * `type="text/plain"`, `Clerk` stays undefined even minutes after mount.
 */
export function isClerkBlockedByCookieYes(): boolean {
  if (typeof window === "undefined") return false;
  if (!isCookieYesLoaded()) return false;

  return typeof (window as { Clerk?: unknown }).Clerk === "undefined";
}

/**
 * Composite check used by save / export / share error paths to decide
 * whether to surface the "Cookies blocking save" toast. Any of the
 * following count as gated:
 *   - user actively rejected non-necessary cookies
 *   - CookieYes is loaded but no consent decision yet (banner still up
 *     or user dismissed without clicking Accept)
 *   - Clerk never booted while CookieYes is loaded (auto-blocker likely
 *     wrapped the script)
 */
export function isSaveGatedByCookieYes(): boolean {
  return (
    hasCookieYesRejection() ||
    isCookieYesConsentUnset() ||
    isClerkBlockedByCookieYes()
  );
}

/**
 * Best-effort attempt to reopen the CookieYes consent banner so the user
 * can accept and unblock Clerk. CookieYes exposes several APIs across
 * releases — try each in order and stop at the first that works.
 * Returns true when a known API was invoked, false otherwise (caller can
 * show a fallback message asking the user to reload).
 */
export function reopenCookieYesBanner(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as unknown as {
      revisitCkyConsent?: () => void;
      CookieYesAPI?: { revisitConsent?: () => void };
    };

    if (typeof w.revisitCkyConsent === "function") {
      w.revisitCkyConsent();

      return true;
    }
    if (typeof w.CookieYesAPI?.revisitConsent === "function") {
      w.CookieYesAPI.revisitConsent();

      return true;
    }

    const trigger = document.querySelector<HTMLElement>(
      '[data-cky-tag="revisit-consent"], .cky-btn-revisit-wrapper button, [class*="cky-btn-revisit"]',
    );

    if (trigger) {
      trigger.click();

      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Shared copy for the "cookies blocking" toast. Kept here so every save /
 * export path surfaces the same message.
 */
export const COOKIE_GATE_TOAST = {
  title: "Cookies blocking save",
  description:
    "Accept cookies from the banner to sign in and save. If the banner is closed, reload the page to reopen it.",
} as const;
