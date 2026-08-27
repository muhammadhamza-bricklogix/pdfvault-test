import Link from "next/link";

import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { UploadWorkspace } from "./upload-workspace";

interface ToolLandingPageProps {
  /** Hero headline shown under the "Back to all tools" link. */
  title: string;
  /** One-sentence hero description shown under the title. */
  description: string;
  /**
   * Editor tool slug consumed by `UploadWorkspace` — becomes `?tool=<slug>`
   * on `/pdf-composer`. See `TOOL_ROUTE` in `lib/shared/constants/tool-routes.ts`
   * for the full list of valid slugs.
   */
  tool: string;
  /**
   * File extensions the picker accepts (without leading dot). Every composer
   * tool takes a PDF by default.
   */
  acceptExtensions?: string[];
}

/**
 * Shared marketing landing shell for every tool that opens the PDF composer
 * with a preselected tool. Mirrors `/convert/[slug]` — hero title +
 * description + `UploadWorkspace(variant="hero")` — so the visitor sees the
 * same "Drag & drop file to edit / Upload to Edit / Size upto 100 MB" screen
 * regardless of which tile they clicked. Each per-tool route (`/edit`,
 * `/compress`, `/split-pdf`, …) is a thin wrapper around this component.
 */
export function ToolLandingPage({
  title,
  description,
  tool,
  acceptExtensions = ["pdf"],
}: ToolLandingPageProps) {
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
            <h1 className="pv-display max-w-[820px] text-[#121212]">{title}</h1>
            <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
              {description}
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="mx-auto w-full max-w-[880px] px-6">
            <UploadWorkspace
              acceptExtensions={acceptExtensions}
              tool={tool}
              variant="hero"
            />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
