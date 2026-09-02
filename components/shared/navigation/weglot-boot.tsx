"use client";

import Script from "next/script";
import { useEffect } from "react";

const WEGLOT_API_KEY = process.env.NEXT_PUBLIC_WEGLOT_API_KEY ?? "";

declare global {
  interface Window {
    Weglot?: {
      initialize: (config: {
        api_key: string;
        originalLanguage?: string;
        destinationLanguages?: string;
        subdirectory?: boolean;
        switchers?: unknown[];
      }) => void;
      switchTo?: (lang: string) => void;
      getCurrentLang?: () => string | undefined;
    };
    __WEGLOT_INITIALIZED__?: boolean;
  }
}

/**
 * Loads the Weglot CDN script and initializes it once in subdirectory
 * mode. Weglot reads the URL path (`/de/...`, `/fr/...`) to pick the
 * target language and translates the DOM client-side.
 *
 * We keep this deliberately minimal:
 *   - No localStorage persistence — the URL is the source of truth.
 *     Our own middleware sets `lang_pref` cookie via the language
 *     switcher; Weglot doesn't need to duplicate that.
 *   - No language-restore logic — visiting `/de/edit` IS the language
 *     signal. No stored preference to re-apply.
 *   - `switchers: []` disables Weglot's floating widget (we render our
 *     own `LanguageSwitcher` / `LandingLanguageSwitcher`).
 *
 * Silently no-ops when `NEXT_PUBLIC_WEGLOT_API_KEY` is unset.
 */
export function WeglotBoot() {
  useEffect(() => {
    // The onLoad handler on <Script> below covers first-load init.
    // This effect is a safety net for the case where Weglot was
    // already loaded (client-side navigation, HMR) but not yet
    // initialized in this render tree.
    if (!WEGLOT_API_KEY) return;
    if (typeof window === "undefined") return;
    if (window.__WEGLOT_INITIALIZED__) return;
    if (!window.Weglot) return;

    window.Weglot.initialize({
      api_key: WEGLOT_API_KEY,
      originalLanguage: "en",
      destinationLanguages: "de,fr,es,pt,ar",
      subdirectory: true,
      switchers: [],
    });
    window.__WEGLOT_INITIALIZED__ = true;
  }, []);

  if (!WEGLOT_API_KEY) return null;

  return (
    <Script
      src="https://cdn.weglot.com/weglot.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (window.__WEGLOT_INITIALIZED__) return;
        window.Weglot?.initialize({
          api_key: WEGLOT_API_KEY,
          originalLanguage: "en",
          destinationLanguages: "de,fr,es,pt,ar",
          subdirectory: true,
          switchers: [],
        });
        window.__WEGLOT_INITIALIZED__ = true;
      }}
    />
  );
}
