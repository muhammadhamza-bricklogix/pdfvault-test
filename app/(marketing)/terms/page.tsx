import type { Metadata } from "next";

import { LegalPageShell } from "@/components/sections/legal/legal-page-shell";
import { TermsAndConditionsContent } from "@/components/sections/legal/terms-and-conditions-content";

export const metadata: Metadata = {
  description:
    "Terms and Conditions governing use of PDF Viewer App (PDFedits) at pdfedits.io.",
  title: "Terms and Conditions",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      ctaHeading="For questions about these terms"
      lastUpdated="May 3, 2026"
      title="Terms and Conditions"
    >
      <TermsAndConditionsContent />
    </LegalPageShell>
  );
}
