import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Edit PDF online";
const DESCRIPTION =
  "Add text, images, signatures, highlights, or drawings to any PDF — no install, no sign-up required.";

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
