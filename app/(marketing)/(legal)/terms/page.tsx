import type { Metadata } from "next";

import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";
import {
  TermsAndConditionsContent,
  termsTocEntries,
} from "@/components/sections/legal/terms-and-conditions-content";

export const metadata: Metadata = {
  description: "Terms and Conditions governing use of PDFedits at pdfedits.io.",
  title: "Terms and Conditions",
};

export default function TermsPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow="FOR QUESTIONS ABOUT THESE TERMS"
      description="The rules and guidelines that govern your use of PDFedits. Please read carefully before using the service."
      heroTitle="Terms and Conditions"
      tocEntries={termsTocEntries}
    >
      <TermsAndConditionsContent />
    </LegalDocumentLayout>
  );
}
