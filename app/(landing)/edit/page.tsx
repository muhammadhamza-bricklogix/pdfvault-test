import type { Metadata } from "next";

import Link from "next/link";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { UploadWorkspace } from "@/components/sections/new-landing/upload-workspace";

const TITLE = "Edit PDF online";
const DESCRIPTION =
  "Add text, images, signatures, highlights, or drawings to any PDF — no install, no sign-up required.";

export const metadata: Metadata = {
  title: `${TITLE} — PDFVault`,
  description: DESCRIPTION,
};

export default function EditLandingPage() {
  return (
    <div id="top">
      <LandingHeader />
      <main>
        <section className="bg-white pt-14 pb-8 sm:pt-20 sm:pb-10">
          <div className="pv-container flex flex-col items-center text-center">
            <Link
              className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-[#5f5f5f] transition-colors hover:text-[var(--pv-brand-red,#f12c23)]"
              href="/"
            >
              <span aria-hidden>←</span> Back to all tools
            </Link>
            <h1 className="pv-display max-w-[820px] text-[#121212]">{TITLE}</h1>
            <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
              {DESCRIPTION}
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="mx-auto w-full max-w-[880px] px-6">
            <UploadWorkspace
              acceptExtensions={["pdf"]}
              tool="edit"
              variant="hero"
            />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
