import type { Metadata } from "next";

import { SubscriptionTermsContent } from "@/components/sections/legal/subscription-terms-content";
import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";

export const metadata: Metadata = {
  title: "Subscription Terms — PDFVault",
  description:
    "The terms that govern your PDFVault trial and monthly subscription — trial pricing, cancellation, refunds, and EU/EEA/UK withdrawal rights.",
};

export default function SubscriptionTermsPage() {
  return (
    <PolicyPageShell
      description="The terms that govern your PDFVault trial and monthly subscription."
      title="Subscription Terms"
    >
      <SubscriptionTermsContent />
    </PolicyPageShell>
  );
}
