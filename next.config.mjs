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
  // Inline above-the-fold CSS + defer the rest via beasties (Next 16
  // built-in). Directly addresses Lighthouse "Render-blocking requests"
  // for the ~57 KB of globals.css + HeroUI styles that block LCP on
  // landing today. Cuts ~80 ms off first render.
  experimental: {
    optimizeCss: true,
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
      {
        source: "/refund",
        destination: "/refund-policy",
        permanent: true,
      },
    ];
  },
  async headers() {
    // The Google Drive / OneDrive picker opens an OAuth popup that
    // navigates to a cross-origin auth page and back. Under the stricter
    // `Cross-Origin-Opener-Policy: same-origin` (which Next.js / Vercel /
    // hosting providers can ship as a default), the popup loses
    // `window.opener` after the cross-origin navigation — our
    // `/oauth-callback` page then can't `postMessage` the access token
    // back to the parent and the picker hangs.
    //
    // We explicitly set `unsafe-none` (rather than the tighter
    // `same-origin-allow-popups`) because Google Tag Assistant Preview
    // opens the site as a popup from `tagassistant.google.com`. Under
    // `same-origin-allow-popups`, the browser puts a cross-origin-opened
    // popup in a separate browsing context group and Tag Assistant can't
    // reach it — Preview shows "window was closed before a connection
    // could be established" and "0 Google tags found" even though the
    // GTM container ships correctly. `unsafe-none` preserves the opener
    // bidirectionally and lets Tag Assistant attach.
    //
    // Safety trade-off: `unsafe-none` disables cross-origin isolation.
    // Safe here because the app doesn't use SharedArrayBuffer or
    // high-precision timers, and the Drive OAuth flow's final
    // postMessage lands on same-origin `/oauth-callback`, which COOP
    // never restricted anyway.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "unsafe-none",
          },
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
