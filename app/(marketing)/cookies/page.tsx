import type { Metadata } from "next";

import { LegalPageShell } from "@/components/sections/legal/legal-page-shell";
import { CookiePolicyContent } from "@/components/sections/legal/cookie-policy-content";

export const metadata: Metadata = {
  description:
    "How PDF Viewer App uses cookies and similar technologies on pdfedits.io.",
  title: "Cookie Policy",
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      ctaHeading="For cookie policy concerns"
      lastUpdated="May 3, 2026"
      title="Cookie Policy"
    >
      <CookiePolicyContent />
    </LegalPageShell>
  );
}
