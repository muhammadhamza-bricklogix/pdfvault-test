import { ImageResponse } from "next/og";

/**
 * Auto-generated Open Graph card served at `/opengraph-image` on every
 * page (Next.js file-based metadata convention). Renders a 1200×630
 * PNG at build/request time from the React tree below, so link
 * previews on Slack, Facebook, LinkedIn, Twitter, WhatsApp, Discord,
 * and iMessage all show a real branded thumbnail instead of the
 * broken `/og.png` 404 that was in metadata before.
 *
 * Design brief:
 *   - PDFVault brand-red gradient background (`--pv-brand-red` #f12c23
 *     → `#470c03` from `globals.css`).
 *   - Large wordmark, tagline, and comma-separated feature list.
 *   - Everything inline text — no external font / image fetches so the
 *     edge runtime renders in < 300 ms and doesn't need a network
 *     round-trip to `landing/logo-with-text.png`.
 *
 * If a per-route override is needed (e.g. a share-page-specific card),
 * drop an `opengraph-image.tsx` into that route folder — Next.js
 * picks the nearest one automatically.
 */

export const runtime = "edge";
export const alt = "PDFVault — PDF tools that work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          width: "100%",
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: "-1px",
            marginBottom: 24,
            opacity: 0.9,
          }}
        >
          pdfvault.ai
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: "-6px",
            lineHeight: 1,
          }}
        >
          PDF tools
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: "-6px",
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          that work.
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 36,
            marginTop: 40,
            opacity: 0.85,
          }}
        >
          Edit · Compress · Convert · Sign · Secure
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 24,
            marginTop: 24,
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
