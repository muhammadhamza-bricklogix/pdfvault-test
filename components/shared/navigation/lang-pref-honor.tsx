"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  DEFAULT_LOCALE,
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

// URL patterns where a full-page reload would destroy in-flight auth
// state that has no client-side recovery. Currently only OAuth callback
// — Clerk needs to complete the token exchange without interference.
// Every other route (including `/pdf-composer`, `/convert/`, editor,
// W-9) does redirect back to the locale prefix, but with the debounce
// below so it doesn't race concurrent `window.location.assign` calls
// from the auto-signup finalize path (item #15 of the auth chain).
const SKIP_REDIRECT_PREFIXES = ["/sso-callback"];

// Delay before the redirect fires. During this window, any URL change
// (e.g. auto-signup's own `window.location.assign` from a signed-out
// upload flow) cancels the pending redirect via the useEffect cleanup,
// then re-schedules on the new pathname. Empirically 1000 ms covers
// the auto-signup finalize → composer navigation without user-visible
// delay on a normal `<Link>` click.
const REDIRECT_DEBOUNCE_MS = 1000;

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
    if (SKIP_REDIRECT_PREFIXES.some((p) => pathname.startsWith(p))) return;

    const pref = readCookie(LANG_PREF_COOKIE);

    if (!pref || pref === DEFAULT_LOCALE) return;
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(pref)) return;

    // Debounce the redirect so it can't race a concurrent
    // `window.location.assign` from the auto-signup finalize flow
    // (item #15 of the auth chain). If the pathname changes during
    // the wait — because auto-signup navigated to a different URL, or
    // a shell effect swapped it — the useEffect cleanup clears this
    // timer and the next fire re-schedules against the new pathname.
    // Once the URL is stable for `REDIRECT_DEBOUNCE_MS`, the reload
    // fires and the user lands on `/{locale}/…` with Clerk's session
    // cookie already committed by the preceding assign.
    const timer = window.setTimeout(() => {
      const suffix = pathname === "/" ? "" : pathname;
      const search = window.location.search ?? "";
      const hash = window.location.hash ?? "";

      window.location.replace(`/${pref}${suffix}${search}${hash}`);
    }, REDIRECT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
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

  // (3) Force Weglot to re-scan the DOM on every locale-prefixed
  // pathname visit.
  //
  // The composer, editor, W-9 form, and other heavy client components
  // dynamic-import their content and mount it AFTER Weglot's initial
  // translation pass has already run. Weglot's body-level MutationObserver
  // should catch these mounts, but in practice — because the composer
  // renders in a nested wrapper and mounts many nodes in the same task —
  // some elements slip past. Result on `/de/pdf-composer`: the URL is
  // German, `Weglot.getCurrentLang()` returns "de", but toolbar / sidebar
  // labels stay English until the user hovers a button (which triggers
  // its OWN mutation the observer catches).
  //
  // Fix: on every locale-prefixed pathname visit, schedule three
  // `Weglot.search()` calls at 400 ms / 1200 ms / 2500 ms. First catches
  // the initial mount, second catches slow-hydration content, third
  // catches lazy dynamic imports. Cheap operation — Weglot skips
  // already-translated nodes internally, so redundant calls no-op.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!parseLocalePrefix(pathname)) return;

    const w = window as typeof window & {
      Weglot?: {
        search?: () => void;
        getCurrentLang?: () => string | undefined;
      };
    };
    const rescan = () => {
      try {
        if (w.Weglot?.getCurrentLang?.() === "en") return;
        w.Weglot?.search?.();
      } catch {
        // Weglot occasionally throws mid-init on race conditions. Safe
        // to swallow — the next scheduled call retries.
      }
    };
    const t1 = window.setTimeout(rescan, 400);
    const t2 = window.setTimeout(rescan, 1200);
    const t3 = window.setTimeout(rescan, 2500);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [pathname]);

  return null;
}
