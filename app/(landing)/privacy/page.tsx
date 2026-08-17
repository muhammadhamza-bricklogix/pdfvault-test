import type { Metadata } from "next";

import Link from "next/link";

import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";
import { PrivacyPolicyContent } from "@/components/sections/legal/privacy-policy-content";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  title: "Privacy Policy — PDFVault",
  description:
    "How PDFVault collects, uses, and protects your personal information when you use pdfvault.ai.",
};

export default function PrivacyPage() {
  return (
    <PolicyPageShell title="Privacy Policy">
      <PrivacyPolicyContent />
      <p>
        See also our <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>.
      </p>
    </PolicyPageShell>
  );
}
