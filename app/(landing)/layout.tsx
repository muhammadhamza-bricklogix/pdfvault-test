import type { ReactNode } from "react";

import { GeistSans } from "geist/font/sans";

import { LandingI18nProvider } from "@/lib/client/i18n/landing-i18n-provider";

import "./landing-theme.css";

export default function NewLandingLayout({
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
