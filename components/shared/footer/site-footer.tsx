"use client";

import { usePathname } from "next/navigation";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { stripLocalePrefix } from "@/lib/shared/constants/locale-map";

// Route prefixes whose screens ship their own footer (LandingFooter) — bail
// out here so we don't stack two footers on the auth pages.
const HIDE_ON_PATHNAMES = ["/sign-in", "/sign-up", "/forgot-password"];

export function SiteFooter() {
  const pathname = usePathname();

  // QA 2026-09-22: mirrors the same fix in SiteNavbar's HIDE_ON_PATHNAMES
  // check — `usePathname()` keeps the `/ar/`, `/de/`, etc. prefix on
  // non-EN locales, so a raw `.startsWith` against these un-prefixed
  // paths silently failed there and would double the footer on
  // `/ar/sign-in` the same way the header duplicated on `/ar/forms/w-9`.
  const strippedPathname = stripLocalePrefix(pathname);

  if (HIDE_ON_PATHNAMES.some((prefix) => strippedPathname.startsWith(prefix))) {
    return null;
  }

  return <LandingFooter />;
}
