import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Edit Any PDF in Seconds";
const DESCRIPTION =
  "Make your changes fast — then download your file as soon as you’re done.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function EditLandingPage() {
  return (
    <ToolLandingPage
      description={DESCRIPTION}
      i18nKey="edit"
      title={TITLE}
      tool="edit"
    />
  );
}
