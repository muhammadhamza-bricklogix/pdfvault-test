import type { Metadata } from "next";

import { LegalPageShell } from "@/components/sections/legal/legal-page-shell";
import { DoNotSellContent } from "@/components/sections/legal/do-not-sell-content";

export const metadata: Metadata = {
  description:
    "California Consumer Privacy Act (CCPA/CPRA) opt-out information for PDF Viewer App.",
  title: "Do Not Sell or Share My Personal Information",
};

export default function DoNotSellPage() {
  return (
    <LegalPageShell
      ctaHeading="Still have questions?"
      lastUpdated="May 3, 2026"
      title="Do Not Sell or Share My Personal Information"
    >
      <DoNotSellContent />
    </LegalPageShell>
  );
}
