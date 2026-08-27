import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Delete PDF pages";
const DESCRIPTION =
  "Remove the pages you no longer need — pick them from the thumbnail view and save a leaner PDF in one step.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function DeletePagesLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="manage" />
  );
}
