// CloudFront Function — geo redirect + bot exemption (viewer-request).
//
// Runs before origin on every locale-less request. On locale-prefixed
// requests, bot user-agents, static assets, or SEO files it short-
// circuits (returns event.request unchanged) so origin caches by path
// alone.
//
// Runtime: CloudFront JS 2.0. No ES modules, no async, no fetch, no
// Node globals — pure sync logic on the event/request/response objects.
// Keep the country map inlined here and mirror it in
// lib/shared/constants/locale-map.ts.
//
// Kill switch: flip `GEO_REDIRECT_ENABLED` to false and republish to
// disable the redirect without removing the function.

// GEO_REDIRECT_ENABLED is the launch kill-switch. Ship as false, flip
// to true after Phase 2 QA. The Node unit-test harness overrides it
// via `module.exports._internal.setEnabled(true)` — see
// `tests/geo/locale-decision.spec.ts`.
var GEO_REDIRECT_ENABLED = false;

var DEFAULT_LOCALE = "en";

// Non-EN locales that get a URL prefix. Keep in sync with
// SUPPORTED_LOCALES minus DEFAULT_LOCALE in the shared constants file.
var PREFIXED_LOCALES = ["de", "fr", "es", "pt", "ar"];

// Country → locale.
var COUNTRY_TO_LOCALE = {
  DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  ES: "es", MX: "es", AR: "es", CL: "es", CO: "es", PE: "es",
  EC: "es", UY: "es", PY: "es", BO: "es", VE: "es", GT: "es",
  CR: "es", PA: "es", DO: "es", HN: "es", SV: "es", NI: "es",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt",
  SA: "ar", AE: "ar", EG: "ar", JO: "ar", KW: "ar", QA: "ar",
  BH: "ar", OM: "ar", IQ: "ar", LB: "ar",
};

var BOT_UA_REGEX = /(Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|PetalBot|Applebot|LinkedInBot|WhatsApp|TelegramBot|Twitterbot)/i;

var LANG_PREF_COOKIE = "lang_pref";

// Paths that must never trigger a geo redirect — bots, sitemap, API,
// static assets, Next.js internals, auth flow, authenticated content,
// share tokens. Client's product spec asks for geo-defaulting on
// "locale-less URLs: homepage, organic, direct" — landing + marketing
// pages. Auth entry pages, Clerk callbacks, and any URL that is either
// authenticated or part of an in-progress auth flow are exempt so we
// never redirect a signed-in user mid-flow.
// 2026-09-02: /dashboard, /pdf-composer, /pdf-editor, /w-9-form,
// /w9-form, /forms/, /share/ were previously exempt to keep user PII
// out of Weglot's server-side Reverse Proxy. In Phase A translation
// happens in the browser (Weglot SDK), so PII never leaves the client
// and geo-redirect on these routes is safe. When Phase B (CloudFront
// Reverse Proxy) ships, re-add those prefixes here AND in `proxy.ts`
// so authenticated content stays on the ALB.
var EXEMPT_PATH_PREFIXES = [
  "/api/",
  "/_next/",
  "/.well-known/",
  "/oauth-callback",      // Clerk OAuth callback
  "/sso-callback",        // Clerk SSO callback
];

var EXEMPT_EXACT_PATHS = {
  "/robots.txt": true,
  "/sitemap.xml": true,
  "/favicon.ico": true,
  "/manifest.webmanifest": true,
  "/manifest.json": true,
  // Auth entry pages — Clerk needs deterministic URLs during sign-in /
  // sign-up flows. Once authenticated the user is redirected to a
  // localized path via `redirect_url`.
  "/sign-in": true,
  "/sign-up": true,
  "/login": true,
  "/signup": true,
  "/forgot-password": true,
};

// Static file extensions that never trigger a geo redirect (image
// requests, fonts, JS/CSS chunks that somehow bypass /_next/).
var STATIC_EXTENSION_REGEX = /\.(html?|css|js|mjs|map|json|jpe?g|webp|png|gif|svg|ico|ttf|otf|woff2?|txt|xml|csv|pdf|docx?|xlsx?|zip|webmanifest)$/i;

function hasLocalePrefix(uri) {
  // Matches "/de", "/de/", "/de/anything".
  for (var i = 0; i < PREFIXED_LOCALES.length; i++) {
    var prefix = "/" + PREFIXED_LOCALES[i];
    if (uri === prefix) return true;
    if (uri.indexOf(prefix + "/") === 0) return true;
  }

  return false;
}

function isExemptPath(uri) {
  if (EXEMPT_EXACT_PATHS[uri]) return true;
  for (var i = 0; i < EXEMPT_PATH_PREFIXES.length; i++) {
    if (uri.indexOf(EXEMPT_PATH_PREFIXES[i]) === 0) return true;
  }
  if (STATIC_EXTENSION_REGEX.test(uri)) return true;

  return false;
}

function headerValue(headers, name) {
  var h = headers[name.toLowerCase()];

  return h && h.value ? h.value : "";
}

function cookieValue(cookies, name) {
  var c = cookies[name.toLowerCase()];

  return c && c.value ? c.value : "";
}

function resolveLocaleFromCountry(country) {
  if (!country) return DEFAULT_LOCALE;
  var upper = String(country).toUpperCase();
  var mapped = COUNTRY_TO_LOCALE[upper];

  return mapped ? mapped : DEFAULT_LOCALE;
}

function isSupportedPrefixedLocale(value) {
  for (var i = 0; i < PREFIXED_LOCALES.length; i++) {
    if (PREFIXED_LOCALES[i] === value) return true;
  }

  return false;
}

// CloudFront Functions JS 2.0 exposes `request.querystring` as an
// object (`{ key: {value: "val", multiValue: [...] } }`), NOT a
// string. An empty object is still truthy in JS, so the old
// `if (querystring)` branch always fired and coerced the object to
// the string "[object Object]" — producing ugly URLs like
// `/de?[object+Object]`. Serialize explicitly to guarantee we only
// append `?a=1&b=2` when there really are params.
function serializeQuerystring(qs) {
  if (!qs || typeof qs !== "object") return "";
  var parts = [];
  for (var key in qs) {
    if (!Object.prototype.hasOwnProperty.call(qs, key)) continue;
    var entry = qs[key];
    if (entry && typeof entry.value === "string") {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(entry.value));
    }
    if (entry && Array.isArray(entry.multiValue)) {
      for (var i = 0; i < entry.multiValue.length; i++) {
        var mv = entry.multiValue[i];
        if (mv && typeof mv.value === "string") {
          parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(mv.value));
        }
      }
    }
  }

  return parts.join("&");
}

function buildRedirectResponse(locale, uri, querystring) {
  var target = "/" + locale + (uri === "/" ? "" : uri);
  var qs = serializeQuerystring(querystring);
  if (qs) target = target + "?" + qs;

  return {
    statusCode: 302,
    statusDescription: "Found",
    headers: {
      location: { value: target },
      "cache-control": { value: "no-store" },
    },
    cookies: {
      // 12-month persistence. Secure + SameSite=Lax so downstream
      // navigations still see the cookie.
      "lang_pref": {
        value: locale,
        attributes: "Path=/; Max-Age=31536000; Secure; SameSite=Lax",
      },
    },
  };
}

function handler(event) {
  var request = event.request;
  var headers = request.headers || {};
  var cookies = request.cookies || {};
  var uri = request.uri || "/";
  var querystring = request.querystring || "";

  if (!GEO_REDIRECT_ENABLED) return request;

  // Locale-prefixed URLs are the canonical crawlable form — never
  // touch them, no matter the geo. This is the "explicit locale wins"
  // guarantee.
  if (hasLocalePrefix(uri)) return request;

  // Bots crawl EN root + explicit locales; they never see a redirect.
  var ua = headerValue(headers, "user-agent");
  if (ua && BOT_UA_REGEX.test(ua)) return request;

  // Static assets, API, sitemap, robots — pass through untouched.
  if (isExemptPath(uri)) return request;

  // Decision order: cookie → geo → EN.
  var pref = cookieValue(cookies, LANG_PREF_COOKIE);
  if (pref === DEFAULT_LOCALE) return request; // EN preference = root, no redirect
  if (isSupportedPrefixedLocale(pref)) {
    return buildRedirectResponse(pref, uri, querystring);
  }

  var country = headerValue(headers, "cloudfront-viewer-country");
  var locale = resolveLocaleFromCountry(country);
  if (locale === DEFAULT_LOCALE) return request; // No redirect needed for EN
  if (isSupportedPrefixedLocale(locale)) {
    return buildRedirectResponse(locale, uri, querystring);
  }

  return request;
}

// CloudFront JS 2.0 exposes `handler` as the entrypoint by declaration.
// Also expose it on `module.exports` so the Node-based unit test
// harness (tests/geo/*) can require this file and assert the response
// shape.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    handler: handler,
    _internal: {
      // Tests toggle the kill switch — mutating a var declared with
      // `var` at file scope is safe under CommonJS in the harness.
      setEnabled: function setEnabled(value) {
        GEO_REDIRECT_ENABLED = value === true;
      },
      isEnabled: function isEnabled() {
        return GEO_REDIRECT_ENABLED;
      },
      DEFAULT_LOCALE: DEFAULT_LOCALE,
      PREFIXED_LOCALES: PREFIXED_LOCALES,
      COUNTRY_TO_LOCALE: COUNTRY_TO_LOCALE,
      BOT_UA_REGEX: BOT_UA_REGEX,
      hasLocalePrefix: hasLocalePrefix,
      isExemptPath: isExemptPath,
      resolveLocaleFromCountry: resolveLocaleFromCountry,
    },
  };
}
