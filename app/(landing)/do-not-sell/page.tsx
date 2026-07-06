import type { Metadata } from "next";

import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";
import { DoNotSellContent } from "@/components/sections/legal/do-not-sell-content";

export const metadata: Metadata = {
  title: "Do Not Sell or Share My Personal Information — PDFVault",
  description:
    "California Consumer Privacy Act (CCPA/CPRA) opt-out information for PDFVault.",
};

export default function DoNotSellPage() {
  return (
    <PolicyPageShell
      description="Your rights under CCPA/CPRA and similar state laws — opt out of sale or sharing."
      title="Do Not Sell or Share My Personal Information"
    >
      <DoNotSellContent />
    </PolicyPageShell>
  );
}
