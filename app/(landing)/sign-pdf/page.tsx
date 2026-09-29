import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Sign PDF online";
const DESCRIPTION =
  "Add your handwritten or typed signature to any PDF — draw with vector strokes, drop it where you need, and save the signed file.";

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
