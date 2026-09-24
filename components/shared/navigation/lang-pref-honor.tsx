"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  DEFAULT_LOCALE,
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

// URL patterns where a full-page reload would destroy in-flight state
// (uploads mid-transfer, auto-signup finalize step, converter pending
// overlay, editor unsaved edits). LangPrefHonor's redirect skips these
// paths — Weglot still translates the underlying page since the URL
// prefix mismatch is only cosmetic while the flow completes.
const SKIP_REDIRECT_PREFIXES = [
  "/pdf-composer",
  "/pdf-editor",
  "/w-9-form",
  "/forms/w-9",
  "/convert/",
  "/sso-callback",
];

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
    // Skip the redirect on paths where a full-page reload would nuke
    // in-flight React state — QA 2026-09-23: main landing → Upload PDF
    // on `/de/` needed two attempts to reach the composer because the
    // reload raced auto-signup's own `window.location.assign`. Weglot
    // still translates the underlying page in place while these flows
    // complete; the URL prefix mismatch is cosmetic.
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
  // German, but toolbar / sidebar labels stay English until the user
  // hovers a button (which triggers its OWN mutation the observer
  // catches).
  //
  // Fix: on every locale-prefixed pathname visit, schedule six
  // `Weglot.search()` calls at 400 / 1200 / 2500 / 5000 / 8000 / 12000
  // ms. The composer + editor keep hydrating for several seconds after
  // route change (Fabric canvas init, pdf.js worker boot, dynamic
  // component chunks) — the shorter 2.5 s ceiling from the first pass
  // of this fix missed the late-arriving toolbar and sidebar text.
  //
  // `Weglot.search()` no-ops on already-translated nodes internally, so
  // extra calls are cheap. We also DO NOT short-circuit on
  // `getCurrentLang() === "en"` here — during the composer's initial
  // hydration Weglot occasionally reports "en" before the URL-driven
  // language switch settles, and skipping search() in that window is
  // the very failure mode that keeps composer text English. Calling
  // search() when Weglot's internal state is still "en" is safe: it
  // just walks the DOM and finds nothing to translate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!parseLocalePrefix(pathname)) return;

    const w = window as typeof window & {
      Weglot?: { search?: () => void };
    };
    const rescan = () => {
      try {
        w.Weglot?.search?.();
      } catch {
        // Weglot occasionally throws mid-init on race conditions. Safe
        // to swallow — the next scheduled call retries.
      }
    };
    const delays = [400, 1200, 2500, 5000, 8000, 12000];
    const timers = delays.map((d) => window.setTimeout(rescan, d));

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
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
  // German, but toolbar / sidebar labels stay English until the user
  // hovers a button (which triggers its OWN mutation the observer
  // catches).
  //
  // Fix: on every locale-prefixed pathname visit, schedule six
  // `Weglot.search()` calls at 400 / 1200 / 2500 / 5000 / 8000 / 12000
  // ms. The composer + editor keep hydrating for several seconds after
  // route change (Fabric canvas init, pdf.js worker boot, dynamic
  // component chunks) — the shorter 2.5 s ceiling from the first pass
  // of this fix missed the late-arriving toolbar and sidebar text.
  //
  // `Weglot.search()` no-ops on already-translated nodes internally, so
  // extra calls are cheap. We also DO NOT short-circuit on
  // `getCurrentLang() === "en"` here — during the composer's initial
  // hydration Weglot occasionally reports "en" before the URL-driven
  // language switch settles, and skipping search() in that window is
  // the very failure mode that keeps composer text English. Calling
  // search() when Weglot's internal state is still "en" is safe: it
  // just walks the DOM and finds nothing to translate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!parseLocalePrefix(pathname)) return;

    const w = window as typeof window & {
      Weglot?: { search?: () => void };
    };
    const rescan = () => {
      try {
        w.Weglot?.search?.();
      } catch {
        // Weglot occasionally throws mid-init on race conditions. Safe
        // to swallow — the next scheduled call retries.
      }
    };
    const delays = [400, 1200, 2500, 5000, 8000, 12000];
    const timers = delays.map((d) => window.setTimeout(rescan, d));

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
