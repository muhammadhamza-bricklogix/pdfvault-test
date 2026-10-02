import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Add Your Electronic Signature Instantly";
const DESCRIPTION =
  "Sign in seconds — then download your signed PDF as soon as you’re done.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function SignPdfLandingPage() {
  return (
    <ToolLandingPage
      description={DESCRIPTION}
      i18nKey="sign"
      title={TITLE}
      tool="sign"
    />
  );
}
