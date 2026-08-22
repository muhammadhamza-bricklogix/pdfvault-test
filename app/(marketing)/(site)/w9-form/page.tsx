import type { Metadata } from "next";

import {
  W9LandingContent,
  buildW9JsonLd,
} from "@/components/sections/forms/W9LandingContent";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfvault.ai"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}/w9-form`;

const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: `Fill Out W-9 Form Online in ${YEAR} — Printable & Editable`,
  description:
    "Fill out the latest IRS Form W-9 online in your browser. Type, tick, sign, and export a clean printable PDF in under 5 minutes — no software install.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: `Fill Out W-9 Form Online in ${YEAR} — Printable & Editable`,
    description:
      "Fill out the IRS W-9 online and export a clean PDF in minutes. Free, browser-based, no install.",
    siteName: "PDFVault",
    images: [{ url: "/logo.svg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Fill Out W-9 Form Online in ${YEAR} — Printable & Editable`,
    description:
      "Fill out the IRS W-9 online and export a clean PDF in minutes. Free, browser-based, no install.",
    images: ["/logo.svg"],
  },
};

export default function W9FormPage() {
  const { howTo, faqLd, breadcrumb } = buildW9JsonLd(PAGE_URL);

  return (
    <>
      <W9LandingContent />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        type="application/ld+json"
      />
    </>
  );
}
