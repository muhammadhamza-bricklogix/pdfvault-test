import type { Metadata } from "next";

import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";
import { TermsAndConditionsContent } from "@/components/sections/legal/terms-and-conditions-content";

export const metadata: Metadata = {
  title: "Terms & Conditions — PDFVault",
  description:
    "The rules and guidelines that govern your use of PDFVault. Please read carefully before using the service.",
};

export default function TermsPage() {
  return (
    <PolicyPageShell
      description="The rules and guidelines that govern your use of PDFVault. Please read carefully before using the service."
      title="Terms & Conditions"
    >
      <TermsAndConditionsContent />
    </PolicyPageShell>
  );
}
