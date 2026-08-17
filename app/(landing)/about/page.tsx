import type { Metadata } from "next";

import { AboutUsContent } from "@/components/sections/legal/about-us-content";
import { PolicyPageShell } from "@/components/sections/policies/policy-page-shell";

export const metadata: Metadata = {
  title: "About PDFVault — A smarter, more secure place for your PDFs",
  description:
    "PDFVault is the all-in-one workspace for everyday document work, built by Content Clicks LLC. Edit, convert, sign, compress, and protect PDFs — all in one place.",
};

export default function AboutPage() {
  return (
    <PolicyPageShell
      description="A smarter, more secure place for your PDFs."
      title="About PDFVault"
    >
      <AboutUsContent />
    </PolicyPageShell>
  );
}
