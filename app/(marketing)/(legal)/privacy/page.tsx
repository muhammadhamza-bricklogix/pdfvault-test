import type { Metadata } from "next";

import Link from "next/link";

import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";
import {
  PrivacyPolicyContent,
  privacyTocEntries,
} from "@/components/sections/legal/privacy-policy-content";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  description:
    "How PDF Viewer App collects, uses, and protects your personal information.",
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow="FOR PRIVACY CONCERNS"
      description="How we collect, use, and protect your personal information when you use pdfedits.io."
      heroTitle="Privacy Policy"
      lastUpdatedLabel="May 2, 2026"
      readMinutes={5}
      tocEntries={privacyTocEntries}
    >
      <PrivacyPolicyContent />
      <p className="text-sm text-[var(--legal-text-muted)]">
        See also our{" "}
        <Link
          className="font-medium text-[var(--legal-burgundy)] underline underline-offset-2 hover:opacity-90"
          href={ROUTES.LEGAL.COOKIES}
        >
          Cookie Policy
        </Link>
        .
      </p>
    </LegalDocumentLayout>
  );
}
