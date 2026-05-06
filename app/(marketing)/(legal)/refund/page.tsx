import type { Metadata } from "next";

import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";
import {
  RefundPolicyContent,
  refundTocEntries,
} from "@/components/sections/legal/refund-policy-content";

export const metadata: Metadata = {
  description:
    "Refund policy and 14-day money-back guarantee for PDF Viewer App subscriptions.",
  title: "Refund Policy",
};

export default function RefundPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow="FOR ANY REFUND CONCERNS"
      description="Our commitment to fair and transparent refunds for PDF Viewer App subscriptions."
      heroTitle="Refund Policy"
      lastUpdatedLabel="May 3, 2026"
      readMinutes={4}
      tocEntries={refundTocEntries}
    >
      <RefundPolicyContent />
    </LegalDocumentLayout>
  );
}
