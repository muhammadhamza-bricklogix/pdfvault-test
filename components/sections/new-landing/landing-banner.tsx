import { ROUTES } from "@/lib/shared/constants/routes";

// Faint decorative tiles layered over the red gradient, echoing the hero grid.
// Positions/sizes are data-driven (percentages) so the texture scales with the
// banner instead of being pinned to fixed pixels.
type BannerTile = { left: string; top: string; size: string; tint: string };

const BANNER_TILES: BannerTile[] = [
  { left: "4%", top: "18%", size: "96px", tint: "rgba(255,255,255,0.06)" },
  { left: "10%", top: "62%", size: "60px", tint: "rgba(0,0,0,0.05)" },
  { left: "26%", top: "30%", size: "44px", tint: "rgba(255,255,255,0.05)" },
  { left: "68%", top: "20%", size: "120px", tint: "rgba(255,255,255,0.05)" },
  { left: "82%", top: "58%", size: "72px", tint: "rgba(0,0,0,0.05)" },
  { left: "90%", top: "26%", size: "48px", tint: "rgba(255,255,255,0.06)" },
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
          className="relative overflow-hidden rounded-[28px] px-6 py-20 text-center sm:py-24"
          style={{
            background:
              "radial-gradient(130% 130% at 50% 118%, var(--pv-brand-primary) 0%, var(--pv-brand-700) 45%, #8c0301 100%)",
          }}
        >
          {/* Decorative tile texture */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {BANNER_TILES.map((tile) => (
              <span
                key={`${tile.left}-${tile.top}`}
                className="absolute rounded-[10px]"
                style={{
                  left: tile.left,
                  top: tile.top,
                  width: tile.size,
                  height: tile.size,
                  background: tile.tint,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <h2 className="max-w-[440px] text-[clamp(26px,3.4vw,36px)] font-bold leading-tight tracking-[-0.02em] text-white">
              Edit and manage PDF documents with ease
            </h2>
            <a
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-gray-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
