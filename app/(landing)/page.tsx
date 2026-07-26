import type { Metadata } from "next";

import { LandingBanner } from "@/components/sections/new-landing/landing-banner";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingFreshStart } from "@/components/sections/new-landing/landing-fresh-start";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";
// Testimonials hidden per PM review 2026-07 (copy pending).
// import { LandingTestimonials } from "@/components/sections/new-landing/landing-testimonials";
import { LandingTools } from "@/components/sections/new-landing/landing-tools";

export const metadata: Metadata = {
  title: "PDFVault — A smarter, more secure home for every PDF",
  // Root layout already sets the PDFVault stacked-layers favicon
  // globally, but Next.js metadata resolution merges per-route
  // overrides — restating it here makes the landing tab keep the
  // brand icon even if the root layout is ever restructured.
  icons: {
    apple: "/PDFVault_stacked_layers.png",
    icon: "/PDFVault_stacked_layers.png",
    shortcut: "/PDFVault_stacked_layers.png",
  },
};

export default function NewLandingPage() {
  return (
    <div id="top">
      <LandingFreshStart />
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingSteps />
        <LandingTools />
        <LandingBanner />
        {/* <LandingTestimonials /> */}
      </main>
      <LandingFooter />
    </div>
  );
}
