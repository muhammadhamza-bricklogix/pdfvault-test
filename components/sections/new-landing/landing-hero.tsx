"use client";

import { useTranslations } from "next-intl";

import { UploadWorkspace } from "./upload-workspace";

export function LandingHero() {
  // Localised via next-intl so QA-flagged German copy (F-06, F-07)
  // renders correctly instead of relying on Weglot's machine
  // translation. See messages/landing/de.json → hero.
  const t = useTranslations("hero");

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-white"
    >
      {/* HeroBackground grid removed per user request — plain white
          background under the hero copy. */}

      <div className="pv-container relative z-10 flex flex-col items-center pt-16 text-center sm:pt-[8vh]">
        <h1
          className="pv-display notranslate wg-notranslate max-w-[760px] text-balance"
          id="hero-heading"
          translate="no"
        >
          {t("title")}
        </h1>
        <p
          className="notranslate wg-notranslate mt-6 max-w-[600px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)] md:max-w-none md:whitespace-nowrap"
          translate="no"
        >
          {t("subtitle")}
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
