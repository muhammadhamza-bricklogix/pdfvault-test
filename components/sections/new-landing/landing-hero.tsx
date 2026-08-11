import { UploadWorkspace } from "./upload-workspace";

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-white"
    >
      {/* HeroBackground grid removed per user request — plain white
          background under the hero copy. */}

      <div className="pv-container relative z-10 flex flex-col items-center pt-24 text-center sm:pt-32">
        <h1 className="pv-display max-w-[760px] text-balance" id="hero-heading">
          Edit, sign, or convert any PDF in seconds
        </h1>
        <p className="mt-6 max-w-[600px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
          Sign, edit, protect and much more. Keep important documents in one
          secure workspace without losing track of files that matter.
        </p>
      </div>

      {/* Compact hero drop-zone (see public/landing/Background+Border.png).
          Wider full-frame variant with cloud chips lives on `/convert/*`. */}
      <div className="relative z-10 mx-auto w-full max-w-[880px] px-6 pb-10 pt-12">
        <UploadWorkspace variant="hero" />
      </div>
    </section>
  );
}
