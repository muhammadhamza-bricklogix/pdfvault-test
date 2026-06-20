import type { Metadata } from "next";

import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";
import {
  DoNotSellContent,
  doNotSellTocEntries,
} from "@/components/sections/legal/do-not-sell-content";

export const metadata: Metadata = {
  description:
    "California Consumer Privacy Act (CCPA/CPRA) opt-out information for PDFedits.io.",
  title: "Do Not Sell or Share My Personal Information",
};

export default function DoNotSellPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow="STILL HAVE QUESTIONS?"
      description="Your rights under CCPA/CPRA and similar state laws — opt out of sale or sharing."
      heroTitle="Do Not Sell or Share My Personal Information"
      tocEntries={doNotSellTocEntries}
    >
      <DoNotSellContent />
    </LegalDocumentLayout>
  );
}
