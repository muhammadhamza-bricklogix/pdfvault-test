import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Extract the Pages You Need — Fast";
const DESCRIPTION =
  "Pick your pages in seconds — then download the new PDF right away.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function SplitPdfLandingPage() {
  return (
    <ToolLandingPage
      description={DESCRIPTION}
      i18nKey="split"
      title={TITLE}
      tool="split"
    />
  );
}
