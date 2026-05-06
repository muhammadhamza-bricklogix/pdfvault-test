import type { Metadata } from "next";

import Link from "next/link";

import { ContactFormSection } from "@/components/sections/legal/contact-form-section";

export const metadata: Metadata = {
  description: "Reach the PDF Viewer App team — replies typically within 24 hours.",
  title: "Contact Us",
};

const SUPPORT_EMAIL = "support@pdfeditsapp.com";

export default function ContactPage() {
  return (
    <article className="mx-auto w-full max-w-xl">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Contact us
        </h1>
        <p className="mt-2 text-xl font-semibold text-[var(--color-foreground)]">
          Get in touch
        </p>
        <p className="mt-3 text-sm text-default-600 dark:text-default-400">
          We&apos;d love to hear from you — our team typically answers within 24
          hours.
        </p>
      </header>

      <ContactFormSection />

      <div className="mt-10 border-t border-default-200 pt-8">
        <p className="text-sm text-default-600 dark:text-default-400">
          Prefer email? Reach us directly at{" "}
          <Link
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
