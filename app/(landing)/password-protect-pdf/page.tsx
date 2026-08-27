import type { Metadata } from "next";

import { ToolLandingPage } from "@/components/sections/new-landing/tool-landing-page";

const TITLE = "Password protect PDF";
const DESCRIPTION =
  "Add a password to your PDF so only the people you share it with can open it — encryption happens right in your browser.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function PasswordProtectPdfLandingPage() {
  return (
    <ToolLandingPage description={DESCRIPTION} title={TITLE} tool="password" />
  );
}
