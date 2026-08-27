import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Unlock PDF";
const DESCRIPTION =
  "Remove the password from a PDF you own so it opens with a single click — no more entering the password every time.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function UnlockPdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="unlock" />
  );
}
