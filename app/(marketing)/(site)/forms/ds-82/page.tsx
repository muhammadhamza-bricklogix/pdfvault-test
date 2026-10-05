import type { Metadata } from "next";

import {
  Ds82LandingContent,
  buildDs82JsonLd,
} from "@/components/sections/forms/Ds82LandingContent";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { ROUTES } from "@/lib/shared/constants/routes";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfvault.ai"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}${ROUTES.FORMS.DS82}`;

const OG_IMAGE = "/static/forms/ds-82-preview.png";

export const metadata: Metadata = {
  title: "Fill Out Form DS-82 Online — U.S. Passport Renewal Application",
  description:
    "Fill out Form DS-82 online in your browser. Renew your U.S. passport by mail, check every answer fits the printed boxes, and download a print-ready PDF to post with your current passport.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Fill Out Form DS-82 Online — U.S. Passport Renewal",
    description:
      "Renew your U.S. passport by mail — fill in Form DS-82 and download a print-ready PDF.",
    siteName: "PDFVault",
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fill Out Form DS-82 Online — U.S. Passport Renewal",
    description:
      "Renew your U.S. passport by mail — fill in Form DS-82 and download a print-ready PDF.",
    images: [OG_IMAGE],
  },
};

export default function Ds82Page() {
  const { howTo, faqLd, breadcrumb } = buildDs82JsonLd(PAGE_URL);

  return (
    <>
      <LandingHeader />
      <Ds82LandingContent />
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
