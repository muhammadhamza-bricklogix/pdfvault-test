import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Remove annotations from PDF";
const DESCRIPTION =
  "Flatten highlights, comments, and form fields into the page so the final PDF looks clean and can't be edited further.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function RemoveAnnotationsLandingPage() {
  return (
    <ToolLandingPage
      description={DESCRIPTION}
      i18nKey="removeAnnotations"
      title={TITLE}
      tool="flatten"
    />
  );
}
