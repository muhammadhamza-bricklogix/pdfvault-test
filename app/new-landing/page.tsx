import type { Metadata } from "next";

import { LandingBanner } from "@/components/sections/new-landing/landing-banner";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";
import { LandingTestimonials } from "@/components/sections/new-landing/landing-testimonials";
import { LandingTools } from "@/components/sections/new-landing/landing-tools";
import { WeglotLoader } from "@/components/shared/navigation/weglot-loader";

export const metadata: Metadata = {
  title: "PDFVault — A smarter, more secure home for every PDF",
  // Landing-page browser/tab icon — the PDFVault mark (overrides the app-wide
  // /logo.svg favicon set in the root layout, for this route only).
  icons: {
    apple: "/landing/icon-only.png",
    icon: "/landing/icon-only.png",
  },
};

export default function NewLandingPage() {
  return (
    <div id="top">
      <WeglotLoader />
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingSteps />
        <LandingTools />
        <LandingBanner />
        <LandingTestimonials />
      </main>
      <LandingFooter />
    </div>
  );
}
