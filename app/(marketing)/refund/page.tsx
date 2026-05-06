import type { Metadata } from "next";

import { LegalPageShell } from "@/components/sections/legal/legal-page-shell";
import { RefundPolicyContent } from "@/components/sections/legal/refund-policy-content";

export const metadata: Metadata = {
  description:
    "Refund policy and 14-day money-back guarantee for PDF Viewer App subscriptions.",
  title: "Refund Policy",
};

export default function RefundPage() {
  return (
    <LegalPageShell
      ctaHeading="For any refund concerns"
      lastUpdated="May 3, 2026"
      title="Refund Policy"
    >
      <RefundPolicyContent />
    </LegalPageShell>
  );
}
