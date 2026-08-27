import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Extract images from PDF";
const DESCRIPTION =
  "Pull every embedded image out of your PDF as separate files — perfect for reusing logos, charts, or photos.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function ExtractImagesLandingPage() {
  return (
    <ToolLandingPage
      description={DESCRIPTION}
      title={TITLE}
      tool="extract-images"
    />
  );
}
