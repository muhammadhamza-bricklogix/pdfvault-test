import type { ReactNode } from "react";

import { GeistSans } from "geist/font/sans";

import "@/app/(landing)/landing-theme.css";

/**
 * /forms/ds-11 renders the LandingHeader inside its page so its chrome
 * matches the marketing landing page. All landing-header design tokens
 * live under the `.pdfvault-landing` scope in landing-theme.css.
 */
export default function Ds11FormLandingLayout({
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
