import path from "node:path";
import { fileURLToPath } from "node:url";

/** App root (this folder), not a parent that may contain another package-lock.json. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Parent dirs (e.g. /Users/softaims/package-lock.json) must not win lockfile discovery —
  // wrong root breaks output tracing and can break Turbopack HMR / stale UI in dev.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
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
        ],
      },
    ];
  },
};

export default nextConfig;
