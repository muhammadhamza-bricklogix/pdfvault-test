import type { ReactNode } from "react";

import { HeroBackground } from "@/components/sections/new-landing/hero-background";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";

interface PolicyPageShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Shared shell for every policy page (privacy, terms, refund, cookies,
 * do-not-sell, contact). Matches Figma frames 2147239362 and 2147239363:
 *
 *   1. Sticky LandingHeader (identical to `/` and `/all-tools`).
 *   2. Centered hero band — giant title + short subhead. Uses the landing
 *      `pv-display` and `pv-body-lg` tokens so type sizing matches the
 *      rest of the site exactly.
 *   3. Narrow content column (max-w-[760px]) with tight prose styling
 *      applied via `.pv-policy-prose` so section headings, paragraphs,
 *      and lists all pick up Figma weight/color without each content
 *      component having to know about it.
 *   4. LandingFooter — same dark-red footer as the landing page.
 *
 * Wrap any policy content component with this shell and it will inherit
 * the landing branding automatically. The `pdfvault-landing` wrapper
 * class comes from `app/(landing)/layout.tsx`, so this shell must be
 * mounted somewhere inside that route group.
 */
export function PolicyPageShell({
  title,
  description,
  children,
}: PolicyPageShellProps) {
  return (
    <div id="top">
      <LandingHeader />
      <main>
        <PolicyHero description={description} title={title} />
        <section className="bg-white pb-24">
          <div className="mx-auto w-full max-w-[760px] px-5 sm:px-6">
            <div className="pv-policy-prose">{children}</div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

function PolicyHero({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-white pb-10 pt-16 sm:pb-14 sm:pt-20">
      <HeroBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-[820px] flex-col items-center px-5 text-center sm:px-6">
        <h1 className="pv-display text-[#121212]">{title}</h1>
        {description ? (
          <p className="mt-6 text-[17px] leading-relaxed max-w-[560px] text-[var(--pv-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
