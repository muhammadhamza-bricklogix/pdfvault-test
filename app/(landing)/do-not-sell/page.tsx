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
    <PolicyPageShell title="Do Not Sell or Share My Personal Information">
      <DoNotSellContent />
    </PolicyPageShell>
  );
}
