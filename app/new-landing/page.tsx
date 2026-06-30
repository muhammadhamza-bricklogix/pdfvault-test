import type { Metadata } from "next";

import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";
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
        {/* More sections are added layer by layer as the build progresses. */}
      </main>
    </div>
  );
}
