import type { Metadata } from "next";

import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";

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
        {/* More sections are added layer by layer as the build progresses. */}
      </main>
    </div>
  );
}
