import fs from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

/**
 * Auto-generated Open Graph card served at `/opengraph-image` on every
 * page (Next.js file-based metadata convention). Renders a 1200×630
 * PNG at request time from the React tree below, so link previews on
 * Slack, Facebook, LinkedIn, Twitter, WhatsApp, Discord, and iMessage
 * all show a real branded thumbnail.
 *
 * Design brief:
 *   - PDFVault brand-red gradient background (from `--pv-brand-red`
 *     #f12c23 in `globals.css`) → deep maroon.
 *   - Stacked-layers logo (`public/PDFVault_stacked_layers.png`)
 *     rendered in the top-left corner. Loaded once at module init via
 *     Node fs + base64-inline so the ImageResponse render never blocks
 *     on a network fetch.
 *   - Wordmark, headline, feature list, subtitle stacked vertically.
 *
 * Runtime is `nodejs` because we read from disk with fs at module
 * load. Cold-start is a hair slower than the pure `edge` variant but
 * still under a second — crawlers cache aggressively so cold-starts
 * are rare in practice.
 *
 * If a per-route override is needed (e.g. a share-page-specific card),
 * drop an `opengraph-image.tsx` into that route folder — Next.js
 * picks the nearest one automatically.
 */

export const runtime = "nodejs";
export const alt = "PDFVault — PDF tools that work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Read the logo once at module load and inline as base64 so the
// ImageResponse render never needs to fetch an external asset.
// Wrapped in try/catch so a missing or unreadable file NEVER breaks
// the OG endpoint on production — we fall back to the text-only card
// (still branded, still valid) rather than 500'ing every crawler.
function loadLogoDataUrl(): string | null {
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "PDFVault_stacked_layers.png",
    );
    const buf = fs.readFileSync(logoPath);

    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const LOGO_DATA_URL = loadLogoDataUrl();

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "flex-start",
          background:
            "linear-gradient(135deg, #f12c23 0%, #b81c15 45%, #470c03 100%)",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: "80px 96px",
          position: "relative",
          width: "100%",
        }}
      >
        {LOGO_DATA_URL ? (
          <img
            alt=""
            height={140}
            src={LOGO_DATA_URL}
            style={{
              marginBottom: 40,
              objectFit: "contain",
            }}
            width={140}
          />
        ) : null}
        <div
          style={{
            color: "#ffffff",
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: "-1px",
            marginBottom: 16,
            opacity: 0.9,
          }}
        >
          pdfvault.ai
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: "-5px",
            lineHeight: 1,
          }}
        >
          PDF tools that work.
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 34,
            marginTop: 32,
            opacity: 0.85,
          }}
        >
          Edit · Compress · Convert · Sign · Secure
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 24,
            marginTop: 16,
            opacity: 0.7,
          }}
        >
          Fast, private, no installs.
        </div>
      </div>
    ),
    { ...size },
  );
}
