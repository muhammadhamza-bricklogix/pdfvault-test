import type { ReactNode } from "react";
import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import { LegalContactBanner } from "@/components/sections/legal/legal-contact-banner";
import { LegalHero } from "@/components/sections/legal/legal-hero";
import { LegalMiniFooter } from "@/components/sections/legal/legal-mini-footer";
import { LegalToc } from "@/components/sections/legal/legal-toc";

type LegalDocumentLayoutProps = {
  children: ReactNode;
  ctaEyebrow: string;
  description: string;
  heroTitle: string;
  lastUpdatedLabel?: string;
  readMinutes: number;
  showContactBanner?: boolean;
  showMiniFooter?: boolean;
  tocEntries: LegalTocEntry[];
};

export function LegalDocumentLayout({
  children,
  ctaEyebrow,
  description,
  heroTitle,
  lastUpdatedLabel,
  readMinutes,
  showContactBanner = true,
  showMiniFooter = false,
  tocEntries,
}: LegalDocumentLayoutProps) {
  const hasToc = tocEntries.length > 0;

  return (
    <article className="w-full">
      <LegalHero
        description={description}
        lastUpdatedLabel={lastUpdatedLabel}
        readMinutes={readMinutes}
        title={heroTitle}
      />
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-8 sm:px-6 lg:px-8">
        {hasToc ? (
          <div className="lg:grid lg:grid-cols-12 lg:gap-10 xl:gap-14">
            <div className="mb-6 lg:col-span-4 xl:col-span-3 lg:mb-0">
              <LegalToc entries={tocEntries} />
            </div>
            <div className="space-y-8 lg:col-span-8 xl:col-span-9">
              {children}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8">{children}</div>
        )}
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {showContactBanner ? <LegalContactBanner eyebrow={ctaEyebrow} /> : null}
        {showMiniFooter ? <LegalMiniFooter /> : null}
      </div>
    </article>
  );
}
