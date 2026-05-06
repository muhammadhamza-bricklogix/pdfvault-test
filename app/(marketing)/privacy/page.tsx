import type { Metadata } from "next";

import Link from "next/link";

import { LegalPageShell } from "@/components/sections/legal/legal-page-shell";
import { PrivacyPolicyContent } from "@/components/sections/legal/privacy-policy-content";

import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  description:
    "How PDF Viewer App collects, uses, and protects your personal information.",
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      ctaHeading="For privacy concerns"
      lastUpdated="May 2, 2026"
      title="Privacy Policy"
    >
      <PrivacyPolicyContent />
      <p className="text-sm text-default-600 dark:text-default-400">
        See also our{" "}
        <Link
          className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90"
          href={ROUTES.LEGAL.COOKIES}
        >
          Cookie Policy
        </Link>
        .
      </p>
    </LegalPageShell>
  );
}
