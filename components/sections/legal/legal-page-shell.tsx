import type { ReactNode } from "react";

import { LegalContactCta } from "@/components/sections/legal/legal-contact-cta";

type LegalPageShellProps = {
  ctaHeading: string;
  children: ReactNode;
  lastUpdated: string;
  title: string;
};

export function LegalPageShell({
  ctaHeading,
  children,
  lastUpdated,
  title,
}: LegalPageShellProps) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-foreground)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-default-500">
          Last updated: {lastUpdated}
        </p>
      </header>
      <div className="space-y-10">{children}</div>
      <LegalContactCta heading={ctaHeading} />
    </article>
  );
}
