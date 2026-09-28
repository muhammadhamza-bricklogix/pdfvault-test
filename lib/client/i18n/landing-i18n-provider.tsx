"use client";

import { usePathname } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { useMemo, type ReactNode } from "react";

import {
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

import { getLandingMessages, type LandingLocale } from "./landing-messages";

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

// Scopes next-intl to the landing / marketing subtree so hand-crafted
// German strings render deterministically without waiting for Weglot's
// DOM MutationObserver to translate.
//
// Locale resolution mirrors ComposerI18nProvider (URL prefix → cookie →
// "en" default) so both surfaces agree on which locale wins.
//
// Partial-migration policy: only DE is authored end-to-end in
// `messages/landing/de.json` today. es/fr/pt/ar are stubbed to EN
// content so migrated call-sites still render (with EN strings), and
// Weglot continues to translate those non-DE locales at runtime — the
// per-element `notranslate` marker used by the composer chrome is
// therefore NOT applied at the provider level here. Individual
// migrated elements can opt in with `translate="no"` as they land.
export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  const locale: LandingLocale = useMemo(() => {
    const parsed = parseLocalePrefix(pathname);

    if (parsed) return parsed.locale as LandingLocale;
    const cookie = readLangPrefCookie();

    if (
      cookie &&
      cookie !== "en" &&
      (SUPPORTED_LOCALES as readonly string[]).includes(cookie)
    ) {
      return cookie as LandingLocale;
    }

    return "en";
  }, [pathname]);

  const messages = useMemo(() => getLandingMessages(locale), [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
