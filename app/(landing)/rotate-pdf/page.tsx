import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Rotate PDF pages";
const DESCRIPTION =
  "Fix sideways or upside-down scans in seconds — rotate one page or every page and save the corrected PDF.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function RotatePdfLandingPage() {
  return (
    <ToolLandingPage
      description={DESCRIPTION}
      hint="rotate"
      title={TITLE}
      tool="manage"
    />
  );
}
