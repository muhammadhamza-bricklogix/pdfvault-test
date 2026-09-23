"use client";

import { usePathname } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

import {
  getComposerMessages,
  type ComposerLocale,
} from "./composer-messages";

function readLangPrefCookie(): string | null {
  if (typeof document === "undefined") return null;
  const target = `${LANG_PREF_COOKIE}=`;
  const parts = document.cookie ? document.cookie.split(";") : [];

  for (const raw of parts) {
    const entry = raw.trim();

    if (entry.startsWith(target)) return entry.slice(target.length);
  }

  return null;
}

// Scopes next-intl to the composer subtree only.
//
// Locale resolution order:
//   1. URL locale prefix (`/de/pdf-composer` → "de")
//   2. `lang_pref` cookie (set by middleware + `LangPrefHonor` on every
//      locale-prefixed visit) — covers the post-signup return case where
//      the redirect lands on bare `/pdf-composer` because it's in
//      `SKIP_REDIRECT_PREFIXES` (PR #115 / #117 reload-race avoidance).
//      Without this fallback the composer flashes English on refresh
//      after auth returns.
//   3. `en` default
//
// The wrapper also stamps `translate="no"` + `notranslate` + `wg-notranslate`
// on its root so Weglot's MutationObserver skips this subtree entirely.
// Otherwise Weglot would race the composer's local strings and produce
// double-translated / flickering text (same class of bug that shipped
// the paywall fence markers in #107 / #110 / #111).
export function ComposerI18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  // Cookie read is client-only (document is undefined on SSR). Start
  // with URL-based locale so SSR + first render match; refine from the
  // cookie once mounted. This does mean the composer flashes EN for one
  // paint on the post-signup bare `/pdf-composer` URL — acceptable since
  // the cookie-refine settles on the same tick and prevents the far
  // worse "entire session is English" bug.
  const urlLocale: ComposerLocale = useMemo(() => {
    const parsed = parseLocalePrefix(pathname);

    return (parsed?.locale ?? "en") as ComposerLocale;
  }, [pathname]);

  const [locale, setLocale] = useState<ComposerLocale>(urlLocale);

  useEffect(() => {
    // If URL has a locale prefix, trust it — it's the strongest signal.
    if (parseLocalePrefix(pathname)) {
      setLocale(urlLocale);

      return;
    }
    // No URL prefix — fall back to the cookie.
    const cookie = readLangPrefCookie();

    if (
      cookie &&
      cookie !== "en" &&
      (SUPPORTED_LOCALES as readonly string[]).includes(cookie)
    ) {
      setLocale(cookie as ComposerLocale);
    } else {
      setLocale("en");
    }
  }, [pathname, urlLocale]);

  const messages = useMemo(() => getComposerMessages(locale), [locale]);

  return (
    <div className="notranslate wg-notranslate contents" translate="no">
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="UTC"
      >
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
