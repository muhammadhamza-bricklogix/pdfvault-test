import type { Metadata } from "next";

import {
  W9LandingContent,
  buildW9JsonLd,
} from "@/components/sections/forms/W9LandingContent";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { ROUTES } from "@/lib/shared/constants/routes";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfvault.ai"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}${ROUTES.FORMS.W9}`;

const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: `Fill Out W-9 Form Online in ${YEAR} — Free IRS W-9 Editor & Download`,
  description:
    "Fill out IRS Form W-9 online in your browser. Type, tick, sign, and export a clean PDF — no install, no signup. Free downloadable blank W-9 included.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: `Fill Out W-9 Form Online in ${YEAR} — Free IRS W-9 Editor`,
    description:
      "Complete the IRS W-9 right in your browser. Edit, sign, and export a clean, professional PDF in minutes.",
    siteName: "PDFVault",
    images: [{ url: "/logo.svg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Fill Out W-9 Form Online in ${YEAR} — Free IRS W-9 Editor`,
    description:
      "Complete the IRS W-9 right in your browser. Edit, sign, and export a clean PDF in minutes.",
    images: ["/logo.svg"],
  },
};

export default function W9Page() {
  const { howTo, faqLd, breadcrumb } = buildW9JsonLd(PAGE_URL);

  return (
    <>
      <LandingHeader />
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
