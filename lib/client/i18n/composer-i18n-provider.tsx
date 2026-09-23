"use client";

import { usePathname } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { useMemo, type ReactNode } from "react";

import { parseLocalePrefix } from "@/lib/shared/constants/locale-map";

import {
  getComposerMessages,
  type ComposerLocale,
} from "./composer-messages";

// Scopes next-intl to the composer subtree only. Reads the URL locale
// prefix on every render (so client-side nav from `/de/...` to `/fr/...`
// re-renders with the right dictionary), falls back to `en` off-prefix.
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

    return (parsed?.locale ?? "en") as ComposerLocale;
  }, [pathname]);

  const messages = useMemo(() => getComposerMessages(locale), [locale]);

  return (
    <div
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
