import type { Metadata } from "next";

import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";
import {
  CookiePolicyContent,
  cookieTocEntries,
} from "@/components/sections/legal/cookie-policy-content";

export const metadata: Metadata = {
  description:
    "How PDFedits uses cookies and similar technologies on pdfedits.io.",
  title: "Cookie Policy",
};

export default function CookiesPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow="FOR COOKIE POLICY CONCERNS"
      description="How we use cookies, local storage, and your choices on pdfedits.io."
      heroTitle="Cookie Policy"
      tocEntries={cookieTocEntries}
    >
      <CookiePolicyContent />
    </LegalDocumentLayout>
  );
}
