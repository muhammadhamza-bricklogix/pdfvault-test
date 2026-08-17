import type { Metadata } from "next";

import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";
import { RefundPolicyContent } from "@/components/sections/legal/refund-policy-content";

export const metadata: Metadata = {
  title: "Refund Policy — PDFVault",
  description:
    "Our commitment to fair and transparent refunds for PDFVault subscriptions.",
};

export default function RefundPage() {
  return (
    <PolicyPageShell title="Refund Policy">
      <RefundPolicyContent />
    </PolicyPageShell>
  );
}
