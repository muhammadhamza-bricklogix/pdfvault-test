import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Organize PDF pages";
const DESCRIPTION =
  "Reorder, rotate, or remove pages in your PDF — drag thumbnails to rearrange and save the result in one click.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function OrganizePdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="manage" />
  );
}
