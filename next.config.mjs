import path from "node:path";
import { fileURLToPath } from "node:url";

import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

/** App root (this folder), not a parent that may contain another package-lock.json. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained `.next/standalone` server folder that copies in
  // only the node_modules actually referenced at runtime — the image we ship
  // to ECS Fargate is ~10x smaller than a full node_modules copy.
  output: "standalone",

  // Serve AVIF first (best compression), fall back to WebP, then original.
  // Next.js image optimizer converts on the fly and caches at the CDN edge.
  // minimumCacheTTL: 30 days — public assets don't change without a new deploy.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2_592_000,
  },
  // Parent dirs (e.g. /Users/brickslogix/package-lock.json) must not win lockfile discovery —
  // wrong root breaks output tracing and can break Turbopack HMR / stale UI in dev.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    // 308 (permanent) preserves method + tells crawlers to update the
    // index. Keeps old bookmarks / marketing links working after the
    // W-9 short URL was renamed to match the pdfguru slug pattern
    // (`/w-9` → `/w-9-form`).
    return [
      {
        source: "/w-9",
        destination: "/w-9-form",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Global Content-Security-Policy. Third-party surface: Clerk (auth iframe +
    // hosted pages), Weglot (translations), Trustpilot (widget), Solidgate
    // (charge-auth iframe), Google (Drive Picker OAuth), Microsoft (OneDrive
    // Picker OAuth), Sentry (browser bundle + reporting). Anything outside
    // these origins is blocked.
    //
    // `frame-ancestors 'none'` replaces X-Frame-Options; `report-only` is NOT
    // used here — we accept short-term breakage over a permissive open policy.
    // If a legitimate third-party source is missed, add it to the appropriate
    // directive rather than removing the directive.
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'", // Next inlines the runtime bootstrap
      "'unsafe-eval'", // Weglot + Sentry require in some flows
      "https://cdn.weglot.com",
      "https://invitejs.trustpilot.com",
      "https://widget.trustpilot.com",
      "https://cdn.charge-auth.com",
      "https://apis.google.com",
      "https://accounts.google.com",
      "https://login.microsoftonline.com",
      "https://clerk.pdfvault.ai",
      "https://*.clerk.accounts.dev",
      "https://challenges.cloudflare.com",
      "https://browser.sentry-cdn.com",
    ].join(" ");

    const connectSrc = [
      "'self'",
      "https://api.pdfvault.ai",
      "https://api.pdfedits.io",
      "https://clerk.pdfvault.ai",
      "https://*.clerk.accounts.dev",
      "https://cdn.weglot.com",
      "https://cache.weglot.com",
      "https://api.weglot.com",
      "https://graph.microsoft.com",
      "https://login.microsoftonline.com",
      "https://accounts.google.com",
      "https://www.googleapis.com",
      "https://oauth2.googleapis.com",
      "https://api.charge-auth.com",
      "https://api.solidgate.com",
      // Sentry ingest is `<orgId>.ingest.<region>.sentry.io` — wildcards
      // cover any org id / region so a rotated or new DSN does not silently
      // start getting blocked without a code change.
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.ingest.de.sentry.io",
      "https://*.sentry.io",
    ].join(" ");

    const frameSrc = [
      "'self'",
      "https://clerk.pdfvault.ai",
      "https://*.clerk.accounts.dev",
      "https://accounts.google.com",
      "https://docs.google.com",
      "https://login.microsoftonline.com",
      "https://cdn.charge-auth.com",
      "https://widget.trustpilot.com",
      "https://challenges.cloudflare.com",
    ].join(" ");

    const imgSrc = [
      "'self'",
      "data:",
      "blob:",
      "https:",
    ].join(" ");

    const styleSrc = [
      "'self'",
      "'unsafe-inline'", // required by HeroUI + Tailwind runtime + Weglot
      "https://cdn.weglot.com",
      "https://fonts.googleapis.com",
    ].join(" ");

    const fontSrc = [
      "'self'",
      "data:",
      "https://fonts.gstatic.com",
      "https://cdn.weglot.com",
    ].join(" ");

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      `connect-src ${connectSrc}`,
      `frame-src ${frameSrc}`,
      `img-src ${imgSrc}`,
      `style-src ${styleSrc}`,
      `font-src ${fontSrc}`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://clerk.pdfvault.ai",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    // The Google Drive / OneDrive picker opens an OAuth popup that
    // navigates to a cross-origin auth page and back. Under the stricter
    // `Cross-Origin-Opener-Policy: same-origin` (which Next.js / Vercel /
    // hosting providers can ship as a default), the popup loses
    // `window.opener` after the cross-origin navigation — our
    // `/oauth-callback` page then can't `postMessage` the access token
    // back to the parent and the picker hangs.
    //
    // `same-origin-allow-popups` keeps cross-origin isolation for the
    // main app while letting popups we OPEN keep their opener pointer.
    // It's the standard COOP value for OAuth flows.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self \"https://cdn.charge-auth.com\"), usb=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      // Public share viewer + bytes endpoint: never cache, never index,
      // never leak referrers. The `/share/[token]` page renders the
      // viewer; `/api/share/bytes/...` streams the PDF.
      {
        source: "/share/:token*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/api/share/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // Apple Pay domain verification file — Solidgate/Apple require
      // `text/plain` and no auth. Extension-less filename means Next
      // defaults to `application/octet-stream`, which Apple rejects.
      {
        source: "/.well-known/apple-developer-merchantid-domain-association",
        headers: [
          { key: "Content-Type", value: "text/plain" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Suppress the Sentry CLI output during builds unless SENTRY_LOG=true.
  silent: process.env.SENTRY_LOG !== "true",

  // Upload source maps to Sentry for readable stack traces.
  // Requires SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT in CI env.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Automatically tree-shake unused Sentry features from the client bundle.
  disableLogger: true,

  // Don't add sourcemaps to production builds — upload only, then delete.
  hideSourceMaps: true,
});
