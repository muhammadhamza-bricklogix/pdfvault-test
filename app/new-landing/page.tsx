import type { Metadata } from "next";

import { LandingBanner } from "@/components/sections/new-landing/landing-banner";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";
import { LandingTestimonials } from "@/components/sections/new-landing/landing-testimonials";
import { LandingTools } from "@/components/sections/new-landing/landing-tools";

export const metadata: Metadata = {
  title: "PDFVault — A smarter, more secure home for every PDF",
};

export default function NewLandingPage() {
  return (
    <div id="top">
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
