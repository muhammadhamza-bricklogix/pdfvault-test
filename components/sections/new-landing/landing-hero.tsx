import { HeroTileGrid } from "./hero-tile-grid";
import { UploadWorkspace } from "./upload-workspace";

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-white"
    >
      {/* Decorative, data-driven tile grid (see HeroTileGrid). */}
      <HeroTileGrid />

      <div className="pv-container relative z-10 flex flex-col items-center pb-10 pt-24 text-center sm:pt-32">
        <h1
          className="pv-display max-w-[760px] text-balance"
          id="hero-heading"
        >
          A smarter, more secure
          <br className="hidden sm:block" /> home for every PDF.
        </h1>
        <p className="mt-6 max-w-[600px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
          Sign, edit, protect and much more. Keep important documents in one
          secure workspace without losing track of files that matter.
        </p>

        <div className="mt-16 w-full">
          <UploadWorkspace />
        </div>
      </div>
    </section>
  );
}
