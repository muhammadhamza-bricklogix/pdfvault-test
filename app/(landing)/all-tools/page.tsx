import type { Metadata } from "next";

import { AllToolsCatalog } from "@/components/sections/new-landing/all-tools-catalog";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
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

/**
 * All Tools — minimal shell. The user asked for "just the operations": no
 * hero, no marketing banner, no testimonials, no footer — only the sticky
 * header on top and the tool catalog below.
 */
export default function AllToolsPage() {
  return (
    <div id="top">
      <WeglotLoader />
      <LandingHeader />
      <main>
        <AllToolsCatalog />
      </main>
    </div>
  );
}
