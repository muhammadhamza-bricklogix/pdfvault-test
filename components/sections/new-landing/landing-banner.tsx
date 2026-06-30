import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Decorative "tech-grid" tiles layered over the red gradient. The pattern is
 * data-driven: each tile is positioned by percentage (so it scales with the
 * banner) with a pixel size and an optional tint / corner radius. Tiles are
 * deliberately concentrated on the darker left side, top and bottom edges, and
 * thin out toward the bright glow on the lower-right — mirroring the reference.
 */
type BannerTile = {
  left: string;
  top: string;
  w: number;
  h: number;
  tint?: string;
  radius?: number;
};

const LIGHT = "rgba(255,158,128,0.13)";
const FAINT = "rgba(255,255,255,0.06)";
const DARK = "rgba(125,0,0,0.18)";

const BANNER_TILES: BannerTile[] = [
  // Hero accents
  { left: "13%", top: "8%", w: 232, h: 118, tint: LIGHT, radius: 26 },
  { left: "41%", top: "9%", w: 62, h: 62, tint: FAINT, radius: 999 },

  // Left-edge cluster
  { left: "0%", top: "13%", w: 70, h: 70, tint: LIGHT },
  { left: "0%", top: "24%", w: 92, h: 24, tint: FAINT },
  { left: "3%", top: "31%", w: 42, h: 42, tint: DARK },
  { left: "0%", top: "49%", w: 26, h: 72, tint: LIGHT },
  { left: "2%", top: "60%", w: 66, h: 34, tint: FAINT },
  { left: "7%", top: "62%", w: 36, h: 36, tint: LIGHT },
  { left: "0%", top: "79%", w: 122, h: 26, tint: LIGHT },
  { left: "4%", top: "83%", w: 60, h: 60, tint: DARK },
  { left: "9%", top: "89%", w: 72, h: 26, tint: FAINT },
  { left: "14%", top: "90%", w: 92, h: 40, tint: LIGHT },
  { left: "21%", top: "84%", w: 40, h: 26, tint: FAINT },
  { left: "25%", top: "92%", w: 60, h: 28, tint: LIGHT },

  // Top edge
  { left: "8%", top: "23%", w: 44, h: 20, tint: FAINT },
  { left: "33%", top: "34%", w: 36, h: 36, tint: LIGHT },
  { left: "50%", top: "10%", w: 82, h: 22, tint: LIGHT },
  { left: "57%", top: "13%", w: 72, h: 20, tint: FAINT },
  { left: "63%", top: "9%", w: 92, h: 24, tint: LIGHT },
  { left: "49%", top: "18%", w: 56, h: 56, tint: FAINT },
  { left: "61%", top: "25%", w: 40, h: 28, tint: DARK },

  // Right side
  { left: "84%", top: "16%", w: 60, h: 60, tint: LIGHT },
  { left: "91%", top: "23%", w: 48, h: 48, tint: FAINT },
  { left: "96%", top: "8%", w: 36, h: 72, tint: LIGHT },
  { left: "97%", top: "46%", w: 42, h: 42, tint: FAINT },
  { left: "82%", top: "31%", w: 28, h: 28, tint: DARK },

  // Lower band (sparser — washed out by the glow)
  { left: "47%", top: "91%", w: 30, h: 24, tint: FAINT },
  { left: "82%", top: "59%", w: 46, h: 30, tint: FAINT },
  { left: "69%", top: "89%", w: 30, h: 18, tint: FAINT },
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      viewBox="0 0 20 20"
      width="16"
    >
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
                key={`${tile.left}-${tile.top}-${tile.w}`}
                className="absolute"
                style={{
                  left: tile.left,
                  top: tile.top,
                  width: tile.w,
                  height: tile.h,
                  background: tile.tint ?? LIGHT,
                  borderRadius: tile.radius ?? 8,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <h2 className="max-w-[560px] text-[clamp(30px,4vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
              Edit and manage PDF documents with ease
            </h2>
            <a
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-gray-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              href={ROUTES.AUTH.SIGN_UP}
            >
              Create your free vault
              <ArrowIcon />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
