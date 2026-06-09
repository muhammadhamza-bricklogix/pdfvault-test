import type { Metadata } from "next";

import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";
import {
  RefundPolicyContent,
  refundTocEntries,
} from "@/components/sections/legal/refund-policy-content";

export const metadata: Metadata = {
  description:
    "Refund policy and 14-day money-back guarantee for Content Clicks LLC subscriptions.",
  title: "Refund Policy",
};

export default function RefundPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow="FOR ANY REFUND CONCERNS"
      description="Our commitment to fair and transparent refunds for Content Clicks LLC subscriptions."
      heroTitle="Refund Policy"
      tocEntries={refundTocEntries}
    >
      <RefundPolicyContent />
    </LegalDocumentLayout>
  );
}
