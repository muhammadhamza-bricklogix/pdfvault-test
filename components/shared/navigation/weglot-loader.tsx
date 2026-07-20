"use client";

import Script from "next/script";

const WEGLOT_API_KEY = process.env.NEXT_PUBLIC_WEGLOT_API_KEY ?? "";

/**
 * localStorage key mirroring the user's active Weglot language.
 * Weglot's own cookie handles this normally, but cookies can be scoped
 * to the origin/subdomain and get dropped across dev↔prod boundaries or
 * when the browser aggressively expires them. Mirroring to
 * localStorage guarantees the choice persists across every route in
 * the app (landing → /sign-in → /pdf-composer etc.), which is the
 * behavior the user asked for.
 */
export const WEGLOT_LANG_STORAGE_KEY = "pdfvault:weglot-lang";

/**
 * Loads Weglot's CDN script and initializes it on window. Both
 * LanguageSwitcher variants listen for the `weglot:initialized` event
 * we dispatch here — until it fires, their buttons stay disabled, which
 * is how we surface a mis-configured deploy instead of console spam on
 * every click.
 *
 * When NEXT_PUBLIC_WEGLOT_API_KEY is not set, we skip both loading the
 * CDN script and dispatching the event. That leaves the switcher in its
 * pre-init disabled state and avoids Weglot's own "must be initialized"
 * / "isn't a language you have added" errors that would otherwise fire
 * on the first click.
 */
export function WeglotLoader() {
  if (!WEGLOT_API_KEY) {
    return null;
  }

  return (
    <Script
      src="https://cdn.weglot.com/weglot.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.Weglot?.initialize({
          api_key: WEGLOT_API_KEY,
          originalLanguage: "en",
          // Match the hreflang subdomains declared in app/layout.tsx —
          // ar, fr, de, pt, es on <lang>.pdfvault.ai.
          destinationLanguages: "ar,fr,de,pt,es",
          // Disable Weglot's own floating switcher — we render our own
          // in the landing header / site navbar (see LanguageSwitcher +
          // LandingLanguageSwitcher). Without this Weglot injects an
          // extra fixed-position widget in the bottom-right corner that
          // overlaps our custom UI.
          switchers: [],
        });

        // Restore the user's language from localStorage. Weglot's own
        // cookie sometimes gets dropped across route groups (auth uses
        // a different (marketing) segment) — mirroring to localStorage
        // makes the choice survive every navigation. Fires AFTER
        // initialize so Weglot is ready to accept switchTo.
        try {
          const stored = window.localStorage.getItem(WEGLOT_LANG_STORAGE_KEY);
          const current = window.Weglot?.getCurrentLang();

          if (stored && stored !== current) {
            window.Weglot?.switchTo(stored);
          }
        } catch {
          // localStorage disabled / private mode — ignore.
        }

        // Any subsequent language change (from our switcher or via any
        // future integration) writes the new value back to localStorage
        // so the next page load picks it up.
        window.Weglot?.on("languageChanged", (lang: string) => {
          try {
            window.localStorage.setItem(WEGLOT_LANG_STORAGE_KEY, lang);
          } catch {
            // ignore
          }
        });

        window.dispatchEvent(new CustomEvent("weglot:initialized"));
      }}
    />
  );
}
