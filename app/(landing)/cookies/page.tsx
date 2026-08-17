import type { Metadata } from "next";

import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";
import { CookiePolicyContent } from "@/components/sections/legal/cookie-policy-content";

export const metadata: Metadata = {
  title: "Cookie Policy — PDFVault",
  description: "How PDFVault uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <PolicyPageShell title="Cookie Policy">
      <CookiePolicyContent />
    </PolicyPageShell>
  );
}
