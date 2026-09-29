import type { ReactNode } from "react";

import { GeistSans } from "geist/font/sans";

import { LandingI18nProvider } from "@/lib/client/i18n/landing-i18n-provider";

import "@/app/(landing)/landing-theme.css";

/**
 * /forms/w-9 renders the LandingHeader inside its page so its chrome
 * matches the marketing landing page. All landing-header design tokens
 * live under the `.pdfvault-landing` scope in landing-theme.css, so
 * this wrapper is required for the header to render with the correct
 * background, container width, and colors.
 *
 * `LandingI18nProvider` is required because `LandingHeader` calls
 * `useTranslations("nav")` — the only mount of the provider is in
 * `app/(landing)/layout.tsx`, and this route lives outside that
 * tree, so the hook otherwise throws and the page dead-ends on the
 * root error boundary.
 */
export default function W9FormLandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${GeistSans.variable} pdfvault-landing bg-white`}>
      <LandingI18nProvider>{children}</LandingI18nProvider>
    </div>
  );
}
