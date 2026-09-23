"use client";

import { usePathname } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { useMemo, type ReactNode } from "react";

import {
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

import { getComposerMessages, type ComposerLocale } from "./composer-messages";

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
// Locale resolution order (all computed synchronously during render via
// useMemo — no effect, no setState. Prior effect+state version tripped
// the react-hooks/set-state-in-effect lint rule):
//   1. URL locale prefix (`/de/pdf-composer` → "de")
//   2. `lang_pref` cookie (set by middleware + `LangPrefHonor` on every
//      locale-prefixed visit) — covers the post-signup return case where
//      the redirect lands on bare `/pdf-composer` because it's in
//      `SKIP_REDIRECT_PREFIXES` (PR #115 / #117 reload-race avoidance).
//      Without this fallback the composer flashes English on refresh
//      after auth returns.
//   3. `en` default
//
// SSR always returns "en" from `readLangPrefCookie` (document is
// undefined) so the server-rendered pass matches an EN cookie, but for
// non-EN cookies the client's first paint may briefly render EN before
// re-rendering with the cookie-derived locale. `suppressHydrationWarning`
// on the fence div swallows the resulting mismatch — visually it's a
// sub-frame flicker at most since the composer's own client-side
// loading shell is what the user actually sees during that window.
//
// The wrapper also stamps `translate="no"` + `notranslate` + `wg-notranslate`
// on its root so Weglot's MutationObserver skips this subtree entirely.
// Otherwise Weglot would race the composer's local strings and produce
// double-translated / flickering text (same class of bug that shipped
// the paywall fence markers in #107 / #110 / #111).
export function ComposerI18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  const locale: ComposerLocale = useMemo(() => {
    const parsed = parseLocalePrefix(pathname);

    if (parsed) return parsed.locale as ComposerLocale;
    const cookie = readLangPrefCookie();

    if (
      cookie &&
      cookie !== "en" &&
      (SUPPORTED_LOCALES as readonly string[]).includes(cookie)
    ) {
      return cookie as ComposerLocale;
    }

    return "en";
  }, [pathname]);

  const messages = useMemo(() => getComposerMessages(locale), [locale]);

  return (
    <div
      suppressHydrationWarning
      className="notranslate wg-notranslate contents"
      translate="no"
    >
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
