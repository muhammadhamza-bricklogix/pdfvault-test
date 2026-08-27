import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Split & extract PDF pages";
const DESCRIPTION =
  "Break a PDF into smaller files or pull out just the pages you need — pick page ranges and download in seconds.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function SplitPdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="split" />
  );
}
