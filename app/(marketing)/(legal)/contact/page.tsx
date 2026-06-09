import type { Metadata } from "next";

import Link from "next/link";

import { ContactFormSection } from "@/components/sections/legal/contact-form-section";
import { LegalDocumentLayout } from "@/components/sections/legal/legal-document-layout";

export const metadata: Metadata = {
  description:
    "Reach the Content Clicks LLC team — replies typically within 24 hours.",
  title: "Contact Us",
};

const SUPPORT_EMAIL = "support@pdfeditsapp.com";

export default function ContactPage() {
  return (
    <LegalDocumentLayout
      ctaEyebrow=""
      description="Get in touch — our team typically answers within 24 hours."
      heroTitle="Contact us"
      showContactBanner={false}
      tocEntries={[]}
    >
      <div className="rounded-2xl border border-[var(--legal-border-subtle)] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-legal-serif text-lg font-semibold text-[var(--legal-burgundy)]">
          Send a message
        </h2>
        <div className="mt-6">
          <ContactFormSection />
        </div>
        <div className="mt-10 border-t border-[var(--legal-border-subtle)] pt-8">
          <p className="text-sm text-[var(--legal-text-muted)]">
            Prefer email? Reach us directly at{" "}
            <Link
              className="font-semibold text-[var(--legal-burgundy)] underline underline-offset-2"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </Link>
            .
          </p>
        </div>
      </div>
    </LegalDocumentLayout>
  );
}
