// Capture + read Google Ads click identifiers (`gclid`, `gbraid`, `wbraid`)
// so the backend can attach them to Offline Conversion Import calls when a
// subscription's day-7 first payment, day-45 rebill, and day-60 rebill
// events fire (Solidgate webhook → backend → Google Ads API).
//
// We can't fire those conversions from the browser: they happen days after
// the user closes the tab. The frontend's job is limited to:
//   1. Capturing the click IDs from the landing URL
//   2. Persisting them in a 1st-party cookie (90-day window matches
//      Google Ads' default conversion attribution window)
//   3. Forwarding them on the checkout-intent request so the backend can
//      associate them with the subscription it creates
//
// `gclid`  — legacy Google Ads click ID (still primary on desktop web)
// `gbraid` — iOS app-conversion identifier used when ITP blocks gclid
// `wbraid` — web-conversion identifier used when 3rd-party cookies are off
// Only one of the three will be set on any given landing URL; we store
// whichever is present.

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const COOKIE_KEYS = {
  clickTimestamp: "pdfvault_gclick_ts",
  gbraid: "pdfvault_gbraid",
  gclid: "pdfvault_gclid",
  wbraid: "pdfvault_wbraid",
} as const;

export interface StoredGoogleClickIds {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  clickTimestamp: string | null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];

  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }

  return null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;

  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ];

  if (isSecure) attrs.push("secure");
  document.cookie = attrs.join("; ");
}

// Bot / crawler landings sometimes carry `?gclid=<junk>` or oversized /
// non-URL-safe strings. Google Ads' real click IDs are alphanumeric +
// `._~%-` in practice; anything else is either garbage or a bot
// fingerprint. Reject at capture time so a bot-poisoned session can't
// forward a broken click ID on checkout-intent and get a 400 back.
const CLICK_ID_MAX_LENGTH = 200;
const CLICK_ID_ALLOWED_CHARS = /^[A-Za-z0-9._~%-]+$/;

function isValidClickId(raw: string | null): raw is string {
  if (!raw) return false;
  if (raw.length > CLICK_ID_MAX_LENGTH) return false;

  return CLICK_ID_ALLOWED_CHARS.test(raw);
}

/**
 * Reads `gclid` / `gbraid` / `wbraid` from the current URL query string
 * and, for each one present, writes a 1st-party cookie that survives 90
 * days. Also stamps a single `clickTimestamp` cookie the first time any
 * click ID is captured — the Google Ads Offline Conversion Import API
 * requires the click-time timestamp on upload, so we preserve the moment
 * the click landed rather than the moment the conversion fires.
 *
 * Idempotent: if the URL has no click IDs, we do nothing. If a click ID
 * IS on the URL and we already have a stored one, we overwrite —
 * assumption is the newer click is the one that should attribute the
 * next conversion.
 *
 * Invalid IDs (empty, oversized, or containing chars outside Ads'
 * observed alphabet) are silently dropped so a bot-crafted landing URL
 * can't poison the cookie.
 */
export function captureGoogleClickIds(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const gclid = params.get("gclid");
  const gbraid = params.get("gbraid");
  const wbraid = params.get("wbraid");

  const validGclid = isValidClickId(gclid) ? gclid : null;
  const validGbraid = isValidClickId(gbraid) ? gbraid : null;
  const validWbraid = isValidClickId(wbraid) ? wbraid : null;

  if (!validGclid && !validGbraid && !validWbraid) return;

  const now = new Date().toISOString();

  if (validGclid) writeCookie(COOKIE_KEYS.gclid, validGclid);
  if (validGbraid) writeCookie(COOKIE_KEYS.gbraid, validGbraid);
  if (validWbraid) writeCookie(COOKIE_KEYS.wbraid, validWbraid);
  writeCookie(COOKIE_KEYS.clickTimestamp, now);
}

/**
 * Returns whatever click IDs are currently stored in cookies. Returns
 * `null` for each field that isn't set. Safe to call at any time,
 * including during SSR (returns all nulls).
 */
export function getStoredGoogleClickIds(): StoredGoogleClickIds {
  return {
    clickTimestamp: readCookie(COOKIE_KEYS.clickTimestamp),
    gbraid: readCookie(COOKIE_KEYS.gbraid),
    gclid: readCookie(COOKIE_KEYS.gclid),
    wbraid: readCookie(COOKIE_KEYS.wbraid),
  };
}
