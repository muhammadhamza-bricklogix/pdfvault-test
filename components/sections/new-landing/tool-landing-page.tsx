import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { UploadWorkspace } from "./upload-workspace";

interface ToolLandingPageProps {
  /** Hero headline shown at the top of the page. */
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
   * tool in the All Tools modal takes a PDF, so this defaults to `["pdf"]`.
   */
  acceptExtensions?: string[];
}

/**
 * Shared marketing landing shell for every entry in the "All Tools" modal
 * that opens the PDF composer with a preselected tool. Mirrors the layout
 * used by `/convert/[slug]` — hero title + description + `UploadWorkspace`
 * — so the visitor sees the same UI regardless of which tool tile they
 * clicked. Each per-tool route (`/edit`, `/compress`, `/organize-pdf`, …)
 * is a thin wrapper around this component.
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
