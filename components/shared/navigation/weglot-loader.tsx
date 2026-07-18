"use client";

import Script from "next/script";

const WEGLOT_API_KEY = process.env.NEXT_PUBLIC_WEGLOT_API_KEY ?? "";

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
        window.dispatchEvent(new CustomEvent("weglot:initialized"));
      }}
    />
  );
}
