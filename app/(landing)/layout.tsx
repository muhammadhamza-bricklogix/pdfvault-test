import type { ReactNode } from "react";

import { GeistSans } from "geist/font/sans";
import Script from "next/script";

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
      {/*
        Trustpilot bootstrap — must live in the server-rendered layout so
        every landing route (/, /edit, /split-pdf, /sign-pdf, /merge-pdf,
        /convert/[slug], …) has the script in SSR HTML. When mounted
        inside a `"use client"` subtree (e.g. ToolLandingPage) `next/script`
        is deferred to client hydration and the widget div stays empty.
      */}
      <Script
        async
        id="trustpilot-bootstrap"
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="lazyOnload"
      />
    </div>
  );
}
