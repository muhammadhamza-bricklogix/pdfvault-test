import type { ReactNode } from "react";

import { GeistSans } from "geist/font/sans";

import "@/app/(landing)/landing-theme.css";

/**
 * /forms/w-9 renders the LandingHeader inside its page so its chrome
 * matches the marketing landing page. All landing-header design tokens
 * live under the `.pdfvault-landing` scope in landing-theme.css, so
 * this wrapper is required for the header to render with the correct
 * background, container width, and colors.
 */
export default function W9FormLandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${GeistSans.variable} pdfvault-landing bg-white`}>
      {children}
    </div>
  );
}
