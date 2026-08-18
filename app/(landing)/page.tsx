import type { Metadata } from "next";

import dynamic from "next/dynamic";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingFreshStart } from "@/components/sections/new-landing/landing-fresh-start";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingHero } from "@/components/sections/new-landing/landing-hero";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";

// Below-fold client components — split into separate JS chunks so the browser
// can prioritise above-fold hydration first. SSR is kept on (default) so
// the HTML content is still present for crawlers and for users on slow JS.
const LandingTools = dynamic(() =>
  import("@/components/sections/new-landing/landing-tools").then(
    (m) => m.LandingTools,
  ),
);

const LandingBanner = dynamic(() =>
  import("@/components/sections/new-landing/landing-banner").then(
    (m) => m.LandingBanner,
  ),
);

const LandingTestimonials = dynamic(() =>
  import("@/components/sections/new-landing/landing-testimonials").then(
    (m) => m.LandingTestimonials,
  ),
);

const LandingFAQ = dynamic(() =>
  import("@/components/sections/new-landing/landing-faq").then(
    (m) => m.LandingFAQ,
  ),
);

export const metadata: Metadata = {
  title: "PDFVault — Edit, sign, or convert any PDF in seconds",
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
        <LandingTestimonials />
        <LandingFAQ />
      </main>
      <LandingFooter />
    </div>
  );
}
