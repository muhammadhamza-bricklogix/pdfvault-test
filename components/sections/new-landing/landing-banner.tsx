"use client";

import { useClientAuthHint } from "@/lib/client/hooks/auth/use-client-auth-hint";
import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Decorative "tech-grid" tiles layered over the red gradient, traced from the
 * reference art. The layout is deliberate, not an even scatter:
 *   - the LEFT side reads as a vertical column (stacked bars, a tall pill, and
 *     two square-with-circle boxes);
 *   - the TOP runs left→right with the big rounded rectangle, a round shape,
 *     then bigger horizontal boxes;
 *   - the RIGHT has only a small cluster top-right;
 *   - the BOTTOM-RIGHT is intentionally empty so the gradient reads as light
 *     emerging from that corner.
 * It is data-driven: each tile is positioned by percentage (scales with the
 * banner) with a pixel size, shape and optional tint / radius.
 */
type BannerTile = {
  left: string;
  top: string;
  w: number;
  h: number;
  shape?: "rect" | "circle";
  tint?: string;
  radius?: number;
};

const LIGHT = "rgba(255,158,128,0.13)";
const FAINT = "rgba(255,255,255,0.05)";
const DARK = "rgba(125,0,0,0.16)";
const RING = "rgba(255,210,190,0.17)";

const BANNER_TILES: BannerTile[] = [
  // ---- LEFT: vertical column ------------------------------------------------
  { left: "0%", top: "9%", w: 14, h: 64, tint: FAINT },
  { left: "0%", top: "27%", w: 14, h: 120, tint: LIGHT },
  { left: "0%", top: "64%", w: 14, h: 70, tint: FAINT },
  { left: "0.5%", top: "83%", w: 96, h: 20, tint: LIGHT },
  // box-with-circle #1 (upper-left)
  { left: "2%", top: "7%", w: 46, h: 46, tint: LIGHT, radius: 12 },
  { left: "2.7%", top: "8.6%", w: 28, h: 28, shape: "circle", tint: RING },
  // tall vertical pill
  { left: "2%", top: "27%", w: 30, h: 150, tint: LIGHT, radius: 999 },
  // box-with-circle #2 (mid-left)
  { left: "2%", top: "66%", w: 46, h: 46, tint: LIGHT, radius: 12 },
  { left: "2.7%", top: "67.6%", w: 28, h: 28, shape: "circle", tint: RING },

  // ---- BOTTOM-LEFT cluster --------------------------------------------------
  { left: "6%", top: "87%", w: 40, h: 30, tint: FAINT },
  { left: "12%", top: "86%", w: 44, h: 44, tint: LIGHT, radius: 12 },
  { left: "12.7%", top: "87.6%", w: 26, h: 26, shape: "circle", tint: RING },
  { left: "18%", top: "87%", w: 46, h: 46, shape: "circle", tint: FAINT },
  { left: "24%", top: "88%", w: 38, h: 38, tint: DARK },
  { left: "1%", top: "96%", w: 120, h: 18, tint: LIGHT },
  { left: "10%", top: "96%", w: 60, h: 16, tint: FAINT },

  // ---- TOP: left → right ----------------------------------------------------
  { left: "13%", top: "8%", w: 150, h: 84, tint: LIGHT, radius: 20 },
  { left: "8%", top: "24%", w: 30, h: 18, tint: FAINT },
  { left: "30%", top: "5%", w: 26, h: 26, tint: FAINT },
  { left: "33%", top: "34%", w: 34, h: 34, tint: DARK },
  { left: "40%", top: "9%", w: 58, h: 58, shape: "circle", tint: RING },
  { left: "49%", top: "18%", w: 54, h: 54, tint: FAINT },
  { left: "50%", top: "10%", w: 82, h: 22, tint: LIGHT },
  { left: "57%", top: "13%", w: 70, h: 20, tint: FAINT },
  { left: "63%", top: "9%", w: 92, h: 24, tint: LIGHT },
  { left: "61%", top: "25%", w: 40, h: 26, tint: DARK },

  // ---- RIGHT: small top-right cluster only ----------------------------------
  { left: "84%", top: "16%", w: 56, h: 56, tint: LIGHT },
  { left: "90%", top: "22%", w: 44, h: 44, tint: FAINT },
  { left: "96%", top: "8%", w: 34, h: 68, tint: LIGHT },
  { left: "88%", top: "31%", w: 30, h: 22, tint: FAINT },
  { left: "97%", top: "33%", w: 34, h: 30, tint: FAINT },
];

function ArrowIcon() {
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 20 20" width="16">
      <path
        d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function LandingBanner() {
  // Was `<Show when="signed-in|signed-out">` from `@clerk/nextjs`, which
  // required the Clerk SDK on landing. Cookie-based hint reads
  // `__client_uat` and renders the correct CTA variant with no Clerk JS.
  // `isLoaded` gate matches the previous <Show> behavior — nothing paints
  // until we know the auth state (avoids a CTA-swap flicker).
  const { isLoaded, isSignedIn } = useClientAuthHint();

  return (
    <section className="bg-[var(--pv-section-gray)] pb-20 sm:pb-24">
      <div className="pv-container">
        <div
          className="relative flex min-h-[clamp(360px,42vw,560px)] items-center justify-center overflow-hidden rounded-[28px] px-6 text-center"
          style={{
            background: [
              // Dark maroon pooling in the bottom-left corner
              "radial-gradient(55% 68% at 1% 104%, rgba(120,0,0,0.85) 0%, rgba(120,0,0,0) 55%)",
              // Hot orange glow rising from the lower-right of centre
              "radial-gradient(78% 92% at 70% 116%, rgba(255,128,78,0.9) 0%, rgba(244,66,32,0.42) 33%, rgba(244,66,32,0) 66%)",
              // Base diagonal: dark red (top-left) → warm orange-red (bottom-right)
              "linear-gradient(122deg, #ab0807 0%, #be1318 46%, #d83a2a 100%)",
            ].join(", "),
          }}
        >
          {/* Decorative tech-grid tiles */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {BANNER_TILES.map((tile) => (
              <span
                key={`${tile.left}-${tile.top}-${tile.w}-${tile.h}`}
                className="absolute"
                style={{
                  left: tile.left,
                  top: tile.top,
                  width: tile.w,
                  height: tile.h,
                  background: tile.tint ?? LIGHT,
                  borderRadius:
                    tile.shape === "circle" ? 999 : (tile.radius ?? 8),
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <h2 className="max-w-[560px] text-[clamp(30px,4vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
              Edit and manage PDF documents with ease
            </h2>
            {isLoaded ? (
              isSignedIn ? (
                <a
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-gray-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  href={ROUTES.APP.DASHBOARD}
                >
                  Manage your PDFs
                  <ArrowIcon />
                </a>
              ) : (
                <a
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-gray-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  href={ROUTES.AUTH.SIGN_UP}
                >
                  Create your free vault
                  <ArrowIcon />
                </a>
              )
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
