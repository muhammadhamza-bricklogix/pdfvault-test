import type { Metadata } from "next";

import { LandingFreshStart } from "@/components/sections/new-landing/landing-fresh-start";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";

import {
  LazyLandingBanner,
  LazyLandingFooter,
  LazyLandingTools,
} from "./_lazy-landing-sections";

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
        <LazyLandingTools />
        <LazyLandingBanner />
        {/* <LandingTestimonials /> */}
      </main>
      <LazyLandingFooter />
    </div>
  );
}
