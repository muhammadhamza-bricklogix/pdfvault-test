import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Add watermark to PDF";
const DESCRIPTION =
  "Stamp any text or logo across your PDF pages — control the color, opacity, and position before you save.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function WatermarkPdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="watermark" />
  );
}
