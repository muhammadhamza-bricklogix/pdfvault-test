import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import {
  BOT_UA_REGEX,
  DEFAULT_LOCALE,
  isSupportedLocale,
  LANG_PREF_COOKIE,
  type Locale,
  LOCALE_HEADER,
  parseLocalePrefix,
  PATHNAME_HEADER,
  PREFIXED_LOCALES,
  resolveLocaleFromCountry,
} from "@/lib/shared/constants/locale-map";

const DASHBOARD_PATH = "/dashboard";
const SIGN_IN_PATH = "/sign-in";

/**
 * When the app runs behind CloudFront (http-only origin), CloudFront replaces
 * the `Host` header with the ALB domain. Clerk's SDK then constructs redirect
 * URLs using that host, which Clerk's API rejects as an invalid redirect_url.
 *
 * CloudFront is configured to inject `X-Forwarded-Host: pdfvault.ai` and
 * `X-Forwarded-Proto: https` as static origin custom headers. Use those to
 * reconstruct the canonical origin so all server-side URL construction
 * references the real public domain, not the ALB.
 */
function getCanonicalOrigin(req: NextRequest): string {
  const fwdHost = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";

  if (fwdHost) return `${fwdProto}://${fwdHost}`;

  // Fallback: use NEXT_PUBLIC_APP_URL (set in ECS task definition for prod)
  // or the request's own origin when running locally / without CloudFront.
  return process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
}

/**
 * Protected-route match against the LOCALE-STRIPPED pathname. Original
 * `createRouteMatcher(["/dashboard(.*)", "/tools/(.*)"])` operates on the
 * raw `req.nextUrl.pathname`, so it would miss `/de/dashboard` — we
 * rewrite locale prefixes internally, but the auth decision has to run
 * before the rewrite so we can't rely on Next.js seeing the stripped
 * form yet. A plain regex over the effective path keeps auth working
 * on every locale variant.
 */
function isProtectedPath(pathname: string): boolean {
  return /^\/(dashboard|tools)(\/|$)/.test(pathname);
}

/**
 * Classifies the `?id=` parameter on the `/pdf-composer` route:
 *   - "absent"  → bare `/pdf-composer` (no `id` param at all). Intentionally
 *     PUBLIC — the editor runs in local upload-and-edit mode without an
 *     account, and the marketing site / navbar / footer link here.
 *   - "empty"   → `/pdf-composer?id=` (param present but blank / whitespace).
 *     Never a valid editor URL (a broken or half-built link) — we bounce the
 *     user out instead of showing a blank editor.
 *   - "present" → `/pdf-composer?id=<docId>`. Needs a signed-in user because
 *     the document fetch is auth-gated. Without this gate, signed-out
 *     visitors hitting an editor URL with an id saw a blank editor + a
 *     "Couldn't open document" toast — QA-reported 2026-06-16.
 *
 * `effectivePath` is the locale-stripped pathname so this classifier
 * fires uniformly on `/pdf-composer` and `/de/pdf-composer` alike.
 */
function editorDocIdState(
  effectivePath: string,
  searchParams: URLSearchParams,
): "absent" | "empty" | "present" {
  if (effectivePath !== "/pdf-composer") return "absent";
  if (!searchParams.has("id")) return "absent";

  return (searchParams.get("id") ?? "").trim() === "" ? "empty" : "present";
}

function redirectToSignIn(req: NextRequest, returnTo: string): NextResponse {
  const signInUrl = new URL(SIGN_IN_PATH, getCanonicalOrigin(req));

  signInUrl.searchParams.set("redirect_url", returnTo);

  return NextResponse.redirect(signInUrl);
}

/**
 * Legacy Weglot subdomains (de.pdfvault.ai, fr.pdfvault.ai, …) 301 to
 * the subdirectory equivalent. Gated behind an env flag so it stays
 * off until Phase 3 — flipping it on before the subdirectory URLs are
 * indexed would strand traffic on redirect chains before Search
 * Console sees the new canonical form.
 *
 * Enable in prod with `LOCALE_SUBDOMAIN_301=on` after subdirectory URLs
 * are live AND Search Console confirms indexing.
 */
function subdomainRedirect(req: NextRequest): NextResponse | null {
  if (process.env.LOCALE_SUBDOMAIN_301 !== "on") return null;

  const host = req.headers.get("host") ?? req.headers.get("x-forwarded-host");

  if (!host) return null;

  const match = host.match(/^(de|fr|es|pt|ar)\.pdfvault\.ai$/i);

  if (!match) return null;

  const locale = match[1].toLowerCase();
  const target = new URL(
    `https://pdfvault.ai/${locale}${req.nextUrl.pathname}`,
  );

  target.search = req.nextUrl.search;

  return NextResponse.redirect(target, 301);
}

/**
 * Paths that must NEVER trigger a geo-IP redirect. These fall into
 * three buckets:
 *
 *   - **Auth flow**: sign-in/up + Clerk callbacks. Redirecting these to
 *     a locale-prefixed variant mid-flow breaks the auth handshake.
 *   - **Authenticated content**: dashboard, editor, W-9, forms, share
 *     tokens. Signed-in users expect deterministic URLs; auth-gated
 *     routes must reach the sign-in bounce cleanly.
 *   - **SEO/plumbing**: `/api`, `/_next`, `robots.txt`, `sitemap.xml`,
 *     favicon, manifest. Never redirect crawlers or asset requests.
 *
 * Mirrors the exempt list in the (dormant) CloudFront Function at
 * `infra/cloudfront-functions/geo-redirect.js` — they must agree on the
 * set of paths so behaviour stays consistent regardless of which edge
 * the redirect fires from.
 */
function isGeoRedirectExempt(pathname: string): boolean {
  // Static assets + Next.js internals + API
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/.well-known/")) return true;

  // SEO plumbing files
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json"
  ) {
    return true;
  }

  // Auth entry pages — Clerk needs deterministic URLs during sign-in /
  // sign-up flows. Once authenticated the user is redirected to a
  // localised path via `redirect_url`, so preserving the locale isn't
  // lost by exempting these entries.
  if (
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/oauth-callback" ||
    pathname === "/sso-callback"
  ) {
    return true;
  }

  // Authenticated content — user PII must not be geo-redirected. These
  // routes serve the user's own file library, editor content, tax
  // forms, or private share tokens.
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/pdf-composer")) return true;
  if (pathname.startsWith("/pdf-editor")) return true;
  if (pathname.startsWith("/w-9-form")) return true;
  if (pathname.startsWith("/w9-form")) return true;
  if (pathname.startsWith("/forms/")) return true;
  if (pathname.startsWith("/share/")) return true;

  return false;
}

/**
 * IP-country geo-redirect on locale-less URLs (Amit's Priority 2).
 *
 * Fires only when `GEO_REDIRECT_ENABLED === "on"` in the environment.
 * Ships dormant so the middleware code can be deployed + tested
 * (verify header forwarding, verify no unintended side-effects) BEFORE
 * the redirect logic activates on real traffic.
 *
 * Decision order (matches Amit's spec):
 *   1. `lang_pref` cookie — user's saved choice always wins.
 *   2. Geo header — `CF-IPCountry` (Weglot's Cloudflare edge) with
 *      fallback to `CloudFront-Viewer-Country` (AWS CloudFront) in case
 *      the request path changes.
 *   3. English fallback for unmapped countries.
 *
 * Bot user-agents are exempt so search crawlers can always index every
 * locale URL directly (they crawl from a single geo, usually US).
 *
 * Path exemptions (see `isGeoRedirectExempt`) protect the auth flow,
 * authenticated content, and SEO plumbing from disruption.
 *
 * The 302 response is marked `Cache-Control: no-store` so Weglot's
 * reverse proxy doesn't cache the redirect — each visitor's decision
 * must be evaluated per-request against their own cookie + geo.
 */
function geoRedirect(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;

  // Explicit locale in URL always wins — never redirect a
  // locale-prefixed URL, even from a foreign IP.
  if (parseLocalePrefix(pathname)) return null;

  if (isGeoRedirectExempt(pathname)) return null;

  // Bots never redirected — they crawl from a single geo (usually US)
  // and must be able to reach every locale URL directly.
  const ua = req.headers.get("user-agent");

  if (ua && BOT_UA_REGEX.test(ua)) return null;

  // Cookie beats geo — user's manual choice or a previously-served
  // locale wins. EN cookie means "stay on root, don't redirect."
  const cookiePref = req.cookies.get(LANG_PREF_COOKIE)?.value;
  const cookieLocale: Locale | null = isSupportedLocale(cookiePref)
    ? cookiePref
    : null;

  // Country header — Weglot's Cloudflare edge sets `CF-IPCountry` on
  // every incoming request and forwards it to our origin. Fallback to
  // AWS CloudFront's `CloudFront-Viewer-Country` in case DNS is ever
  // routed back through our own CDN.
  const country =
    req.headers.get("cf-ipcountry") ??
    req.headers.get("cloudfront-viewer-country");
  const geoLocale = resolveLocaleFromCountry(country);

  const targetLocale: Locale = cookieLocale ?? geoLocale;

  // Debug logging — enable with `GEO_REDIRECT_DEBUG=on` to trace the
  // decision inputs in ECS logs WITHOUT actually redirecting. Useful
  // to verify Weglot forwards `CF-IPCountry` before flipping the
  // redirect live. Kept behind a separate flag so we're not flooding
  // logs once redirects are enabled.
  if (process.env.GEO_REDIRECT_DEBUG === "on") {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        source: "geo-redirect",
        path: pathname,
        cfIpCountry: req.headers.get("cf-ipcountry"),
        cfViewerCountry: req.headers.get("cloudfront-viewer-country"),
        acceptLanguage: req.headers.get("accept-language")?.slice(0, 60),
        cookieLocale,
        geoLocale,
        targetLocale,
        wouldRedirect:
          targetLocale !== DEFAULT_LOCALE && cookieLocale !== DEFAULT_LOCALE,
        enabled: process.env.GEO_REDIRECT_ENABLED === "on",
      }),
    );
  }

  if (process.env.GEO_REDIRECT_ENABLED !== "on") return null;

  if (cookieLocale === DEFAULT_LOCALE) return null;

  if (targetLocale === DEFAULT_LOCALE) return null;

  // Build target URL: /<locale>/<original-path>?<original-query>
  const target = req.nextUrl.clone();

  target.pathname = `/${targetLocale}${pathname === "/" ? "" : pathname}`;

  const response = NextResponse.redirect(target, 302);

  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(LANG_PREF_COOKIE, targetLocale, {
    maxAge: 60 * 60 * 24 * 365, // 12 months (matches Amit's spec)
    path: "/",
    sameSite: "lax",
    secure: true,
  });

  return response;
}

/**
 * Attaches the locale + original pathname to the outgoing request
 * headers so `app/layout.tsx` can read them for `<html lang dir>` and
 * for per-URL canonical + hreflang generation. Both headers are
 * request-only — Next.js strips request headers from the response, so
 * they never leak to the browser.
 */
function withLocaleHeaders(
  req: NextRequest,
  locale: string,
  originalPathname: string,
): Headers {
  const headers = new Headers(req.headers);

  headers.set(LOCALE_HEADER, locale);
  headers.set(PATHNAME_HEADER, originalPathname);

  return headers;
}

export default clerkMiddleware(async (auth, req) => {
  // Step 0a: retire legacy Weglot subdomains once Phase 3 flips on.
  const subdomain301 = subdomainRedirect(req);

  if (subdomain301) return subdomain301;

  // Step 0b: geo-IP redirect on locale-less URLs (Amit's Priority 2).
  // Dormant until `GEO_REDIRECT_ENABLED=on` is set in the environment.
  // Fires before locale parsing so a user in Germany hitting `/edit`
  // is 302'd to `/de/edit` before Clerk auth checks run — which is
  // important because the return URL after sign-in would otherwise
  // point at the wrong locale.
  const geo = geoRedirect(req);

  if (geo) return geo;

  // Step 1: split the URL into locale prefix + effective app path.
  // English is the root default, so pathnames without a prefix stay
  // as-is and use the DEFAULT_LOCALE.
  const parsed = parseLocalePrefix(req.nextUrl.pathname);
  const effectivePath = parsed ? parsed.rest : req.nextUrl.pathname;
  const locale = parsed?.locale ?? DEFAULT_LOCALE;

  // Step 2: run the existing auth-chain guards against the stripped
  // path so `/de/pdf-composer?id=X` behaves identically to
  // `/pdf-composer?id=X`. The auth-flow-guardian invariants (empty-id
  // bounce, protected-route sign-in redirect) must fire regardless of
  // locale prefix.
  const idState = editorDocIdState(effectivePath, req.nextUrl.searchParams);

  if (idState === "empty") {
    const { userId } = await auth();

    if (!userId) {
      return redirectToSignIn(req, DASHBOARD_PATH);
    }

    return NextResponse.redirect(
      new URL(DASHBOARD_PATH, getCanonicalOrigin(req)),
    );
  }

  if (isProtectedPath(effectivePath) || idState === "present") {
    const { userId } = await auth();

    if (!userId) {
      // Preserve the ORIGINAL locale-prefixed path in the return URL so
      // the user lands back on the same localized page after signing in.
      return redirectToSignIn(req, req.nextUrl.pathname + req.nextUrl.search);
    }
  }

  // Step 3: internal rewrite for prefixed locales so the un-prefixed
  // Next.js route tree renders the page. The URL bar keeps the locale
  // prefix; the server sees the stripped path.
  const requestHeaders = withLocaleHeaders(req, locale, req.nextUrl.pathname);

  if (parsed) {
    const rewriteUrl = req.nextUrl.clone();

    rewriteUrl.pathname = parsed.rest;

    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
  }

  // EN pass-through: no rewrite needed, but attach the locale/pathname
  // headers so `generateMetadata` still emits correct canonical +
  // hreflang for the root pages.
  return NextResponse.next({ request: { headers: requestHeaders } });
});

// Static asserts that PREFIXED_LOCALES tracks what the middleware
// matcher and CloudFront Function believe about supported prefixes.
// If a new locale is added, the compile-time reference here fails
// until the matcher below is updated.
void PREFIXED_LOCALES;

export const config = {
  matcher: [
    // `.well-known/**` is excluded so Apple Pay domain verification
    // (`apple-developer-merchantid-domain-association`) and any future
    // machine-readable metadata are served straight from `public/`
    // without a Clerk redirect. The file has no extension, so the
    // static-file exclusion below doesn't catch it.
    //
    // `robots.txt`, `sitemap.xml`, `favicon.ico`, manifest files are
    // excluded so we never geo-redirect crawlers on SEO plumbing.
    "/((?!\\.well-known|_next|robots\\.txt|sitemap\\.xml|favicon\\.ico|manifest\\.(?:webmanifest|json)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
