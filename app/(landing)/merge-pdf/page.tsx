import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Merge PDF files";
const DESCRIPTION =
  "Combine multiple PDFs into one — drop your first file, add the rest, and download a single merged PDF in seconds.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function MergePdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="merge" />
  );
}
