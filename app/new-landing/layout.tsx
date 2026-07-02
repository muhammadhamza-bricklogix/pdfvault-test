import type { ReactNode } from "react";

import { GeistSans } from "geist/font/sans";

import "./landing-theme.css";

export default function NewLandingLayout({
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
