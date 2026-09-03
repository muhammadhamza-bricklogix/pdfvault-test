/**
 * Central source of truth for locale-based routing and geo-IP defaulting.
 *
 * English lives at the root of pdfvault.ai (no `/en/` prefix). Non-EN
 * locales live under a subdirectory prefix — `/de/`, `/fr/`, `/es/`,
 * `/pt/`, `/ar/`. The CloudFront Function at the edge and the Next.js
 * middleware here must agree on the same set of locales and country map.
 *
 * Mirror any change here into `infra/cloudfront-functions/geo-redirect.js`.
 */

export const DEFAULT_LOCALE = "en" as const;

/**
 * Every locale the app serves. EN is the root default; the others get
 * a URL prefix. Keep the order stable for hreflang emission tests.
 */
export const SUPPORTED_LOCALES = ["en", "de", "fr", "es", "pt", "ar"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Locales that get a URL prefix (non-EN). EN is implicit at the root.
 * Use this list for middleware prefix parsing.
 */
export const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
) as Exclude<Locale, "en">[];

/**
 * Right-to-left locales. Currently only Arabic. The root layout flips
 * `dir="rtl"` on `<html>` for these; logical CSS properties in the
 * app shell handle the rest. The Fabric.js editor canvas explicitly
 * stays LTR — do not add editor-adjacent locales here.
 */
export const RTL_LOCALES: readonly Locale[] = ["ar"];

/**
 * BCP-47 tags for `<html lang>` and `og:locale` metadata.
 */
export const OG_LOCALE_TAG: Record<Locale, string> = {
  en: "en_US",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  pt: "pt_PT",
  ar: "ar_SA",
};

/**
 * ISO 3166-1 alpha-2 country codes → language decision.
 *
 * Priority order at request time is: `lang_pref` cookie → this map →
 * DEFAULT_LOCALE. AR-country IPs (Gulf region) map to English at launch
 * until the RTL audit is signed off — swap the AR block back on at that
 * point. Morocco/Algeria/Tunisia (MA/DZ/TN) are pending Amit's call
 * (AR vs FR); default EN until confirmed.
 *
 * Countries not in this map default to EN (see `resolveLocaleFromCountry`).
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // German
  DE: "de",
  AT: "de",
  CH: "de",
  LI: "de",

  // French
  FR: "fr",
  BE: "fr",
  LU: "fr",
  MC: "fr",

  // Spanish
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  PE: "es",
  EC: "es",
  UY: "es",
  PY: "es",
  BO: "es",
  VE: "es",
  GT: "es",
  CR: "es",
  PA: "es",
  DO: "es",
  HN: "es",
  SV: "es",
  NI: "es",

  // Portuguese
  PT: "pt",
  BR: "pt",
  AO: "pt",
  MZ: "pt",

  // Arabic (Gulf).
  SA: "ar",
  AE: "ar",
  EG: "ar",
  JO: "ar",
  KW: "ar",
  QA: "ar",
  BH: "ar",
  OM: "ar",
  IQ: "ar",
  LB: "ar",

  // MA / DZ / TN — pending product decision (AR vs FR). Default EN.
};

export function resolveLocaleFromCountry(
  country: string | null | undefined,
): Locale {
  if (!country) return DEFAULT_LOCALE;
  const upper = country.toUpperCase();

  return COUNTRY_TO_LOCALE[upper] ?? DEFAULT_LOCALE;
}

/**
 * Cookie name for the persisted user language choice. Set by:
 *   - CloudFront Function on a geo redirect (12-month Max-Age)
 *   - Language switcher when the user picks a language manually
 *   - Optionally mirrored to Clerk user metadata on signup
 *
 * `lang_pref` always wins over the geo header. Treat as a functional
 * cookie for consent purposes.
 */
export const LANG_PREF_COOKIE = "lang_pref";

/**
 * Bot user-agent regex. Bots crawl from a single geo (usually US) and
 * must reach every locale URL directly — they NEVER get geo-redirected.
 * Applied at the CloudFront Function AND mirrored here for the
 * middleware/subdomain-301 branch to reuse.
 */
export const BOT_UA_REGEX =
  /(Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|PetalBot|Applebot|LinkedInBot|WhatsApp|TelegramBot|Twitterbot)/i;

/**
 * Header names shared between middleware, layout, and metadata.
 * Middleware sets these on the request after locale-prefix rewrite;
 * `app/layout.tsx` reads them via `next/headers` to set `<html lang>`
 * and emit per-URL canonical + hreflang. Both headers are stripped
 * from the response so they never leak to the browser.
 */
export const LOCALE_HEADER = "x-pdfvault-locale";
export const PATHNAME_HEADER = "x-pdfvault-pathname";

/**
 * Parses `/de/edit`, `/fr/compress`, etc. Returns the locale + the
 * stripped path (with leading slash preserved). Returns `null` for
 * paths without a supported locale prefix so the caller can treat
 * them as EN root.
 */
export function parseLocalePrefix(pathname: string): {
  locale: Exclude<Locale, "en">;
  rest: string;
} | null {
  const match = pathname.match(/^\/(de|fr|es|pt|ar)(\/.*|$)/);

  if (!match) return null;
  const locale = match[1] as Exclude<Locale, "en">;
  const rest = match[2] || "/";

  return { locale, rest };
}

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}
