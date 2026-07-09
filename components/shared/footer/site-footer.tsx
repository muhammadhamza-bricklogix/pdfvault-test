"use client";

import { usePathname } from "next/navigation";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";

// Route prefixes whose screens ship their own footer (LandingFooter) — bail
// out here so we don't stack two footers on the auth pages.
const HIDE_ON_PATHNAMES = ["/sign-in", "/sign-up"];

export function SiteFooter() {
  const pathname = usePathname();

  if (
    pathname &&
    HIDE_ON_PATHNAMES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  return <LandingFooter />;
}
