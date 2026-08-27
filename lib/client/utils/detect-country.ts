// Client-side ISO 3166-1 alpha-2 country detection used to tag every
// API request with `x-country-code` so the backend GeoService can quote
// local pricing when the request path lacks a CDN geo header (localhost
// dev, direct Railway hits, etc.). Backend still trusts CDN headers
// first — this is the fallback signal.
//
// Detection priority (timezone-first — physical location signal):
//   1. IANA timezone → country lookup (Asia/Karachi → PK, etc.).
//      Every major OS reports the device's actual local time zone,
//      so this is the strongest signal for where the user is.
//   2. `Intl.Locale(navigator.language).region` — fallback when the
//      timezone isn't in our map or the browser doesn't expose it.
//   3. Parse `xx-YY` from `navigator.language` / `navigator.languages`.
//
// Locale used to be the primary source, but most browsers ship
// `en-US` by default regardless of the user's country — so a
// Pakistan-based user with a stock Chrome would get flagged as US
// and see USD pricing. Timezone dodges that trap.
//
// Result is memoised — the timezone and locale don't change mid-session.

let cached: string | null | undefined;

export function detectClientCountry(): string | null {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") {
    cached = null;

    return cached;
  }

  cached = detectFromTimezone() ?? detectFromLocale() ?? null;

  return cached;
}

function detectFromLocale(): string | null {
  const candidates: string[] = [];

  if (typeof navigator !== "undefined") {
    if (navigator.language) candidates.push(navigator.language);
    if (Array.isArray(navigator.languages)) {
      for (const tag of navigator.languages) {
        if (typeof tag === "string") candidates.push(tag);
      }
    }
  }

  for (const tag of candidates) {
    const region = regionFromLocale(tag);

    if (region) return region;
  }

  return null;
}

function regionFromLocale(tag: string): string | null {
  try {
    const region = new Intl.Locale(tag).region;

    if (region && /^[A-Z]{2}$/.test(region)) return region;
  } catch {
    // Fall through to the string-parse path.
  }

  const parts = tag.split("-");

  for (const part of parts.slice(1)) {
    const upper = part.toUpperCase();

    if (/^[A-Z]{2}$/.test(upper)) return upper;
  }

  return null;
}

function detectFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!tz) return null;
    if (TIMEZONE_TO_COUNTRY[tz]) return TIMEZONE_TO_COUNTRY[tz];

    // Fallback for zones we haven't enumerated — infer from the
    // continent/city pattern where possible. Only used when the exact
    // tz isn't mapped; safe to return null so the backend keeps its
    // own default.
    return null;
  } catch {
    return null;
  }
}

// Compact IANA timezone → ISO alpha-2 map covering every country the
// backend's pricing catalog supports. Multi-timezone countries list
// only the primary zones — full coverage isn't required because
// `Intl.Locale` handles most desktop browsers, and the backend
// fallback to USA/USD still fires when neither signal resolves.
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Asia
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Dhaka": "BD",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN",
  "Asia/Manila": "PH",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kuching": "MY",
  "Asia/Singapore": "SG",
  "Asia/Hong_Kong": "HK",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Jerusalem": "IL",
  "Asia/Tel_Aviv": "IL",
  "Asia/Istanbul": "TR",
  "Europe/Istanbul": "TR",
  // Europe
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Luxembourg": "LU",
  "Europe/Vienna": "AT",
  "Europe/Zurich": "CH",
  "Europe/Lisbon": "PT",
  "Europe/Athens": "GR",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  // Africa / Middle East
  "Africa/Cairo": "EG",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
  // Americas
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "America/Detroit": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Montreal": "CA",
  "America/Halifax": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Mexico_City": "MX",
  "America/Cancun": "MX",
  "America/Monterrey": "MX",
  "America/Tijuana": "MX",
  "America/Sao_Paulo": "BR",
  "America/Fortaleza": "BR",
  "America/Manaus": "BR",
  "America/Recife": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Buenos_Aires": "AR",
  "America/Santiago": "CL",
  "America/Bogota": "CO",
  "America/Lima": "PE",
  // Oceania
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Hobart": "AU",
  "Pacific/Auckland": "NZ",
};

// Test-only helper — allows unit tests to reset the memoised result
// between cases without exporting mutable state.
export function __resetDetectedCountryCache(): void {
  cached = undefined;
}
