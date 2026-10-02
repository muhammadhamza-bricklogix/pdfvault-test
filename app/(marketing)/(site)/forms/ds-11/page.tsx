import type { Metadata } from "next";

import {
  Ds11LandingContent,
  buildDs11JsonLd,
} from "@/components/sections/forms/Ds11LandingContent";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { ROUTES } from "@/lib/shared/constants/routes";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfvault.ai"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}${ROUTES.FORMS.DS11}`;

const OG_IMAGE = "/static/forms/ds-11-preview-v2.png";

export const metadata: Metadata = {
  title: "Fill Out Form DS-11 Online — U.S. Passport Application Editor",
  description:
    "Fill out Form DS-11 online in your browser. Complete your U.S. passport application, check every answer fits the printed boxes, and download a print-ready PDF.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Fill Out Form DS-11 Online — U.S. Passport Application",
    description:
      "Complete your passport application fast — then download the PDF as soon as you are done.",
    siteName: "PDFVault",
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fill Out Form DS-11 Online — U.S. Passport Application",
    description:
      "Complete your passport application fast — then download the PDF as soon as you are done.",
    images: [OG_IMAGE],
  },
};

export default function Ds11Page() {
  const { howTo, faqLd, breadcrumb } = buildDs11JsonLd(PAGE_URL);

  return (
    <>
      <LandingHeader />
      <Ds11LandingContent />
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
