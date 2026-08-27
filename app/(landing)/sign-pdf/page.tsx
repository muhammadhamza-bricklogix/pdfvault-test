import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Sign PDF";
const DESCRIPTION =
  "Add your signature to any PDF with vector strokes — draw, type, or upload, then export a clean signed file.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function SignPdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="sign" />
  );
}
