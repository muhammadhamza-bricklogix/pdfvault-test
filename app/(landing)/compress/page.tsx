import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Compress PDF";
const DESCRIPTION =
  "Shrink your PDF's file size while keeping text sharp and images clear — perfect for email or web upload.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function CompressLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="compress" />
  );
}
