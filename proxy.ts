import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  parseLocalePrefix,
  PATHNAME_HEADER,
  PREFIXED_LOCALES,
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
  // Step 0: retire legacy Weglot subdomains once Phase 3 flips on.
  const subdomain301 = subdomainRedirect(req);

  if (subdomain301) return subdomain301;

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
