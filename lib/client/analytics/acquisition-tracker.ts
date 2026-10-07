/**
 * Client-side Acquisition Source Tracking.
 *
 * Implements First-Touch Attribution (stored in a 1st-party cookie + localStorage for 90 days).
 *
 * Sources categorized:
 *  - Google Ads: gclid, gbraid, wbraid, or utm_source=google + paid medium
 *  - Bing Ads: msclkid, or utm_source=bing/bingads/msn + paid medium
 *  - Paid Social: Facebook Ads, TikTok Ads, LinkedIn Ads, Twitter/X Ads, etc.
 *  - Organic Search: Google, Bing, Yahoo, DuckDuckGo, Ecosia, etc. (no ad click ID)
 *  - Organic Social: Non-ad visits from social networks
 *  - Referral: External sites
 *  - Direct: No referrer or same-origin, no campaign parameters
 */

const COOKIE_NAME = "pdfvault_attribution";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

export interface AcquisitionData {
  source: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  gclid?: string;
  msclkid?: string;
  gbraid?: string;
  wbraid?: string;
  referrer?: string;
  landingUrl?: string;
  landedAt: string;
  details?: Record<string, unknown>;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];

  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function writeCookie(name: string, value: string): void {
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

const SEARCH_ENGINE_DOMAINS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Google", pattern: /(^|\.)google\.[a-z]{2,}(\.[a-z]{2})?$/i },
  { name: "Bing", pattern: /(^|\.)bing\.com$/i },
  { name: "Yahoo", pattern: /(^|\.)yahoo\.com$/i },
  { name: "DuckDuckGo", pattern: /(^|\.)duckduckgo\.com$/i },
  { name: "Ecosia", pattern: /(^|\.)ecosia\.org$/i },
  { name: "Baidu", pattern: /(^|\.)baidu\.com$/i },
  { name: "Yandex", pattern: /(^|\.)yandex\.[a-z]+$/i },
];

const SOCIAL_DOMAINS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Facebook", pattern: /(^|\.)(facebook\.com|fb\.com)$/i },
  { name: "Instagram", pattern: /(^|\.)instagram\.com$/i },
  { name: "TikTok", pattern: /(^|\.)tiktok\.com$/i },
  { name: "LinkedIn", pattern: /(^|\.)(linkedin\.com|lnkd\.in)$/i },
  { name: "Twitter / X", pattern: /(^|\.)(twitter\.com|t\.co|x\.com)$/i },
  { name: "YouTube", pattern: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { name: "Reddit", pattern: /(^|\.)reddit\.com$/i },
  { name: "Pinterest", pattern: /(^|\.)pinterest\.com$/i },
];

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsearch",
  "paidsocial",
  "display",
  "banner",
  "ads",
]);

function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);

    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Categorizes source and medium based on click IDs, UTM parameters, and referrer.
 */
function classifyTraffic(params: {
  gclid?: string | null;
  msclkid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
}): { source: string; medium?: string } {
  const { gclid, msclkid, gbraid, wbraid, utmSource, utmMedium, referrer } =
    params;
  const normSource = utmSource?.trim().toLowerCase() || "";
  const normMedium = utmMedium?.trim().toLowerCase() || "";

  // 1. Google Ads click identifiers or explicit UTMs
  if (gclid || gbraid || wbraid) {
    return { source: "Google Ads", medium: normMedium || "cpc" };
  }
  if (
    normSource.includes("google") ||
    normSource.includes("adwords") ||
    normSource === "googleads"
  ) {
    if (PAID_MEDIUMS.has(normMedium)) {
      return { source: "Google Ads", medium: normMedium || "cpc" };
    }

    return { source: "Google", medium: normMedium || "referral" };
  }

  // 2. Bing Ads click identifier (msclkid) or explicit UTMs
  if (msclkid) {
    return { source: "Bing Ads", medium: normMedium || "cpc" };
  }
  if (
    normSource.includes("bing") ||
    normSource.includes("msn") ||
    normSource.includes("bingads")
  ) {
    if (PAID_MEDIUMS.has(normMedium)) {
      return { source: "Bing Ads", medium: normMedium || "cpc" };
    }

    return { source: "Bing", medium: normMedium || "referral" };
  }

  // 3. Other known ad platforms
  if (normSource.includes("facebook") || normSource.includes("meta")) {
    return {
      source: PAID_MEDIUMS.has(normMedium) ? "Facebook Ads" : "Facebook",
      medium: normMedium || (PAID_MEDIUMS.has(normMedium) ? "cpc" : "social"),
    };
  }
  if (normSource.includes("tiktok")) {
    return {
      source: PAID_MEDIUMS.has(normMedium) ? "TikTok Ads" : "TikTok",
      medium: normMedium || (PAID_MEDIUMS.has(normMedium) ? "cpc" : "social"),
    };
  }
  if (normSource.includes("linkedin")) {
    return {
      source: PAID_MEDIUMS.has(normMedium) ? "LinkedIn Ads" : "LinkedIn",
      medium: normMedium || (PAID_MEDIUMS.has(normMedium) ? "cpc" : "social"),
    };
  }
  if (
    normSource.includes("twitter") ||
    normSource === "x" ||
    normSource === "x.com"
  ) {
    return {
      source: PAID_MEDIUMS.has(normMedium) ? "Twitter Ads" : "Twitter / X",
      medium: normMedium || (PAID_MEDIUMS.has(normMedium) ? "cpc" : "social"),
    };
  }

  // 4. Generic UTM Source if present
  if (utmSource) {
    const formatted =
      utmSource.charAt(0).toUpperCase() + utmSource.slice(1).toLowerCase();

    return {
      source: PAID_MEDIUMS.has(normMedium) ? `${formatted} Ads` : formatted,
      medium: normMedium || "campaign",
    };
  }

  // 5. Referrer inspection
  if (referrer) {
    const refHost = extractHostname(referrer);

    if (refHost) {
      // Check organic search
      for (const engine of SEARCH_ENGINE_DOMAINS) {
        if (engine.pattern.test(refHost)) {
          return {
            source:
              engine.name === "Google"
                ? "Google (Organic)"
                : engine.name === "Bing"
                  ? "Bing (Organic)"
                  : `Organic Search (${engine.name})`,
            medium: "organic",
          };
        }
      }

      // Check social networks
      for (const social of SOCIAL_DOMAINS) {
        if (social.pattern.test(refHost)) {
          return { source: social.name, medium: "social" };
        }
      }

      // Other external website referral
      return { source: `Referral (${refHost})`, medium: "referral" };
    }
  }

  // 6. Direct / Unknown
  return { source: "Direct", medium: "none" };
}

/**
 * Capture acquisition metadata from the URL and referrer upon initial arrival.
 * Preserves FIRST-TOUCH attribution across internal navigation, but allows
 * new explicit marketing campaign clicks (gclid, msclkid, utm_source) to initiate
 * a new acquisition session (e.g. when multiple users share the same browser).
 */
export function captureAcquisition(): void {
  if (typeof window === "undefined") return;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const gclid = searchParams.get("gclid");
    const msclkid = searchParams.get("msclkid");
    const gbraid = searchParams.get("gbraid");
    const wbraid = searchParams.get("wbraid");
    const utmSource = searchParams.get("utm_source");
    const utmMedium = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");
    const utmTerm = searchParams.get("utm_term");
    const utmContent = searchParams.get("utm_content");

    const hasExplicitCampaign = Boolean(
      gclid || msclkid || gbraid || wbraid || utmSource,
    );

    // If an attribution session already exists and this is internal navigation
    // (no new campaign or ad click on the URL), preserve the original first touch.
    const existing = getStoredAcquisition();

    if (
      !hasExplicitCampaign &&
      existing?.source &&
      existing.source !== "Direct"
    ) {
      return;
    }

    let referrer = document.referrer ? document.referrer : null;

    if (referrer) {
      const refHost = extractHostname(referrer);
      const currentHost = window.location.hostname.toLowerCase();

      // Ignore same-origin referrer
      if (refHost === currentHost) {
        referrer = null;
      }
    }

    const { source, medium } = classifyTraffic({
      gclid,
      msclkid,
      gbraid,
      wbraid,
      utmSource,
      utmMedium,
      referrer,
    });

    // If existing is already "Direct" and new landing is also "Direct", keep existing.
    if (existing?.source === "Direct" && source === "Direct") {
      return;
    }

    const landingPath = `${window.location.pathname}${window.location.search}`;

    const data: AcquisitionData = {
      source,
      medium: medium || undefined,
      campaign: utmCampaign || undefined,
      term: utmTerm || undefined,
      content: utmContent || undefined,
      gclid: gclid || undefined,
      msclkid: msclkid || undefined,
      gbraid: gbraid || undefined,
      wbraid: wbraid || undefined,
      referrer: referrer || undefined,
      landingUrl: landingPath,
      landedAt: new Date().toISOString(),
      details: {
        rawReferrer: referrer || null,
        landingUrl: landingPath,
        capturedAt: new Date().toISOString(),
      },
    };

    const serialized = JSON.stringify(data);

    writeCookie(COOKIE_NAME, serialized);
    try {
      localStorage.setItem(COOKIE_NAME, serialized);
    } catch {
      // LocalStorage might be disabled or full
    }
  } catch {
    // Fail gracefully
  }
}

/**
 * Retrieve the currently stored first-touch acquisition data.
 * Safe during SSR (returns null).
 */
export function getStoredAcquisition(): AcquisitionData | null {
  if (typeof window === "undefined") return null;

  // Try cookie first
  const cookieVal = readCookie(COOKIE_NAME);

  if (cookieVal) {
    try {
      return JSON.parse(cookieVal) as AcquisitionData;
    } catch {
      // Fallback
    }
  }

  // Fallback to localStorage
  try {
    const storageVal = localStorage.getItem(COOKIE_NAME);

    if (storageVal) {
      return JSON.parse(storageVal) as AcquisitionData;
    }
  } catch {
    // LocalStorage access may throw in private mode
  }

  return null;
}

/**
 * Clear stored acquisition data from cookie and localStorage.
 * Called upon sign out to ensure shared devices start clean for the next user.
 */
export function clearStoredAcquisition(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  try {
    localStorage.removeItem(COOKIE_NAME);
  } catch {
    // Fail silently
  }
}
