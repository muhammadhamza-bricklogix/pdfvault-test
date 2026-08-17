import type { Metadata } from "next";

import Link from "next/link";

import { ContactFormSection } from "@/components/sections/legal/contact-form-section";
import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";

export const metadata: Metadata = {
  title: "Contact us — PDFVault",
  description: "Reach the PDFVault team — replies typically within 24 hours.",
};

const SUPPORT_EMAIL = "support@pdfvault.ai";

export default function ContactPage() {
  return (
    <PolicyPageShell
      description="Get in touch — our team typically answers within 24 hours."
      title="Contact us"
    >
      <div>
        <h2>Send a message</h2>
        <div className="mt-6">
          <ContactFormSection />
        </div>
        <p className="mt-8">
          Prefer email? Reach us directly at{" "}
          <Link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>.
        </p>
      </div>
    </PolicyPageShell>
  );
}
