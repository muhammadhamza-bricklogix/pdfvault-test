import type { Metadata } from "next";

import {
  NecLandingContent,
  buildNecJsonLd,
} from "@/components/sections/forms/NecLandingContent";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { ROUTES } from "@/lib/shared/constants/routes";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfvault.ai"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}${ROUTES.FORMS.NEC_1099}`;

const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: `Fill Out 1099-NEC Form Online in ${YEAR} — Nonemployee Compensation Editor & Download`,
  description:
    "Fill out IRS Form 1099-NEC online in your browser. Complete nonemployee compensation, payer & recipient TINs, and download a clean PDF — no install, no signup.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: `Fill Out 1099-NEC Form Online in ${YEAR} — Free 1099-NEC Editor`,
    description:
      "Complete Form 1099-NEC directly in your browser. Edit, verify, and export a clean, professional PDF in minutes.",
    siteName: "PDFVault",
    images: [{ url: "/static/forms/1099-nec-preview.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Fill Out 1099-NEC Form Online in ${YEAR} — Free 1099-NEC Editor`,
    description:
      "Complete Form 1099-NEC directly in your browser. Edit and download a clean PDF in minutes.",
    images: ["/static/forms/1099-nec-preview.png"],
  },
};

export default function Nec1099Page() {
  const { howTo, faqLd, breadcrumb } = buildNecJsonLd(PAGE_URL);

  return (
    <>
      <LandingHeader />
      <NecLandingContent />
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
