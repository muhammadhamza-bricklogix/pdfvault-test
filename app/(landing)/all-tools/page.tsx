import type { Metadata } from "next";

import { AllToolsCatalog } from "@/components/sections/new-landing/all-tools-catalog";
import { LandingBanner } from "@/components/sections/new-landing/landing-banner";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingTestimonials } from "@/components/sections/new-landing/landing-testimonials";
import { WeglotLoader } from "@/components/shared/navigation/weglot-loader";

export const metadata: Metadata = {
  title: "All tools — PDFVault",
  description:
    "Every PDFVault tool in one place — edit, convert, compress, and organise PDFs, all built for a fast, secure browser workflow.",
  icons: {
    apple: "/landing/icon-only.png",
    icon: "/landing/icon-only.png",
  },
};

export default function AllToolsPage() {
  return (
    <div id="top">
      <WeglotLoader />
      <LandingHeader />
      <main>
        <PageHero />
        <AllToolsCatalog />
        <LandingBanner />
        <LandingTestimonials />
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * Compact page hero — reuses the landing typography (`pv-display`) so the
 * page opens with the same visual weight as `/`, but without the upload
 * workspace since users landing here already know what tool they want.
 */
function PageHero() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="pv-container flex flex-col items-center text-center">
        <h1 className="pv-display max-w-[720px] text-[#121212]">
          A smarter, more secure home for every PDF.
        </h1>
        <p className="mt-6 text-[17px] leading-relaxed max-w-[560px] text-[var(--pv-text-secondary)]">
          Sign, edit, protect and much more. Keep important documents in one
          secure workspace without losing track of files that matter.
        </p>
      </div>
    </section>
  );
}
