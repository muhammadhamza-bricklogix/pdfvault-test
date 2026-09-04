"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  DEFAULT_LOCALE,
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  const parts = document.cookie ? document.cookie.split(";") : [];

  for (const raw of parts) {
    const entry = raw.trim();

    if (entry.startsWith(target)) return entry.slice(target.length);
  }

  return null;
}

// Honors the `lang_pref` cookie client-side. Server-side geo-redirect
// (CloudFront Function) is dormant (GEO_REDIRECT_ENABLED=false) and dev
// has no CloudFront at all, so without this the cookie is only set —
// never read. On any prefix-less pathname, if the cookie names a
// non-default locale, replace-navigate to `/{locale}<path>` once.
export function LangPrefHonor() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (parseLocalePrefix(pathname)) return;

    const pref = readCookie(LANG_PREF_COOKIE);

    if (!pref || pref === DEFAULT_LOCALE) return;
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(pref)) return;

    const suffix = pathname === "/" ? "" : pathname;
    const search = window.location.search ?? "";
    const hash = window.location.hash ?? "";

    window.location.replace(`/${pref}${suffix}${search}${hash}`);
  }, [pathname]);

  return null;
}
