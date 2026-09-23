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

  // (1) Redirect prefix-less URLs when the cookie names a non-default
  // locale. Runs after (2) so the cookie has a chance to be set on the
  // FIRST hit before the user starts navigating.
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

  // (2) Capture the current URL's locale prefix into the cookie so
  // subsequent client-side `<Link>` navigations (which drop the prefix
  // because Next.js doesn't run middleware on soft nav) can be routed
  // back to `/{locale}/...` by effect (1) above.
  //
  // Without this, users who land DIRECTLY on `/de/` from a Google Ads
  // campaign never trigger the middleware redirect (`proxy.ts:308`
  // that sets the cookie), so their next `<Link>` click drops them on
  // English. Set on every locale-prefixed pathname visit — same
  // attributes as the middleware sets on redirect.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const parsed = parseLocalePrefix(pathname);

    if (!parsed) return;
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(parsed.locale)) {
      return;
    }

    const existing = readCookie(LANG_PREF_COOKIE);

    if (existing === parsed.locale) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";

    document.cookie = `${LANG_PREF_COOKIE}=${parsed.locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  }, [pathname]);

  return null;
}
