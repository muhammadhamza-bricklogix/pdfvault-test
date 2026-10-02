"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { LandingFooter } from "./landing-footer";
import { LandingFreshStart } from "./landing-fresh-start";
import { LandingHeader } from "./landing-header";
import { LandingSteps } from "./landing-steps";
import { LandingTestimonials } from "./landing-testimonials";
import { UploadWorkspace } from "./upload-workspace";

// Below-fold client sections — mirror the root `/` landing's dynamic imports
// so each tool landing ships the full page (hero → steps → tools → banner →
// testimonials → FAQ → footer) with the same chunking strategy.
const LandingTools = dynamic(() =>
  import("./landing-tools").then((m) => m.LandingTools),
);
const LandingBanner = dynamic(() =>
  import("./landing-banner").then((m) => m.LandingBanner),
);
const LandingFAQ = dynamic(() =>
  import("./landing-faq").then((m) => m.LandingFAQ),
);

interface ToolLandingPageProps {
  /** Hero headline shown at the top of the page. */
  title: string;
  /** One-sentence hero description shown under the title. */
  description: string;
  /**
   * Editor tool slug consumed by `UploadWorkspace` — becomes `?tool=<slug>`
   * on `/pdf-composer`. See `TOOL_ROUTE` in `lib/shared/constants/tool-routes.ts`
   * for the full list of valid slugs.
   */
  tool: string;
  /**
   * File extensions the picker accepts (without leading dot). Every composer
   * tool takes a PDF by default.
   */
  acceptExtensions?: string[];
  /**
   * Opt-in localisation. When set, the render layer reads the hero
   * title + description from `messages/landing/*.json → toolPages.<i18nKey>`
   * instead of the raw `title` / `description` props. Falls back to the
   * plain props when unset, so `/convert/[slug]` routes (which
   * generate titles from user-selected formats) continue to work
   * untouched. QA F-22 / F-23 / F-24 / F-25 / F-14.
   */
  i18nKey?: "sign" | "split" | "removeAnnotations" | "edit";
}

/**
 * Shared marketing landing shell for every tool that opens the PDF composer
 * with a preselected tool. Mirrors `/convert/[slug]` — hero title +
 * description + `UploadWorkspace(variant="hero")` — so the visitor sees the
 * same "Drag & drop file to edit / Upload to Edit / Size upto 100 MB" screen
 * regardless of which tile they clicked. Each per-tool route (`/edit`,
 * `/compress`, `/split-pdf`, …) is a thin wrapper around this component.
 */
export function ToolLandingPage({
  title,
  description,
  tool,
  acceptExtensions = ["pdf"],
  i18nKey,
}: ToolLandingPageProps) {
  const t = useTranslations("toolPages");
  // Prefer localised copy when available. `useTranslations` throws when
  // a key is missing, so guard the read against unknown i18n keys with a
  // try/catch fallback to the raw props. This keeps the pre-i18n
  // `/convert/[slug]` call-sites working.
  let localisedTitle: string | null = null;
  let localisedDescription: string | null = null;

  if (i18nKey) {
    try {
      localisedTitle = t(`${i18nKey}.title`);
      localisedDescription = t(`${i18nKey}.description`);
    } catch {
      localisedTitle = null;
      localisedDescription = null;
    }
  }

  const heroTitle = localisedTitle ?? title;
  const heroDescription = localisedDescription ?? description;
  // Fence the localised hero copy from Weglot so its cached
  // EN→translated mapping doesn't overwrite the authored German.
  const fenceProps = i18nKey
    ? { className: "notranslate wg-notranslate", translate: "no" as const }
    : {};

  return (
    <div id="top">
      <LandingFreshStart />
      <LandingHeader />
      <main>
        <section className="bg-white pt-14 pb-8 sm:pt-20 sm:pb-10">
          <div className="pv-container flex flex-col items-center text-center">
            <h1
              {...fenceProps}
              className={`font-bold leading-[1.05] tracking-[-0.03em] whitespace-nowrap text-[clamp(15px,5.5vw,56px)] text-[#121212] ${fenceProps.className ?? ""}`.trim()}
            >
              {heroTitle}
            </h1>
            <p
              {...fenceProps}
              className={`mt-6 font-medium leading-relaxed whitespace-nowrap text-[clamp(11px,2.3vw,20px)] text-[var(--pv-gray-8)] ${fenceProps.className ?? ""}`.trim()}
            >
              {heroDescription}
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="mx-auto w-full max-w-[880px] px-6">
            <UploadWorkspace
              acceptExtensions={acceptExtensions}
              tool={tool}
              variant="hero"
            />
          </div>
        </section>
        <LandingSteps />
        <LandingTools />
        <LandingBanner />
        <LandingTestimonials />
        <LandingFAQ />
      </main>
      <LandingFooter />
    </div>
  );
}
