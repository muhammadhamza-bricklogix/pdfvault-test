"use client";

import Script from "next/script";

import { logger } from "@/lib/shared/utils/logger";

const WEGLOT_API_KEY = process.env.NEXT_PUBLIC_WEGLOT_API_KEY ?? "";

const LOG_PREFIX = "[WeglotLoader]";

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
 * Window key used by the inline preload script in app/layout.tsx to
 * communicate the persisted language to Weglot before the CDN bundle
 * finishes loading. This lets us restore the user's choice as early as
 * possible and reduces the English flash on first load.
 */
const WEGLOT_PREFERRED_LANG_KEY = "__WEGLOT_PREFERRED_LANG__";

declare global {
  interface Window {
    [WEGLOT_PREFERRED_LANG_KEY]?: string;
    __WEGLOT_INITIALIZED__?: boolean;
  }
}

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
 *
 * Initialization is guarded by `window.__WEGLOT_INITIALIZED__` so the
 * component stays safe even if it is rendered more than once (the single
 * instance in app/layout.tsx is the canonical one; child pages used to
 * duplicate it and that caused race conditions).
 */
export function WeglotLoader() {
  if (!WEGLOT_API_KEY) {
    logger.warn(
      `${LOG_PREFIX} NEXT_PUBLIC_WEGLOT_API_KEY is missing — loader disabled`,
    );

    return null;
  }

  return (
    <Script
      src="https://cdn.weglot.com/weglot.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        logger.debug(
          `${LOG_PREFIX} CDN script loaded. window.Weglot present?`,
          !!window.Weglot,
        );

        if (window.__WEGLOT_INITIALIZED__) {
          // Already initialized by another mount; do not re-attach listeners
          // or re-dispatch the event. The single dispatch below is enough.
          logger.debug(
            `${LOG_PREFIX} Already initialized — skipping repeat init`,
          );

          return;
        }

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

        window.__WEGLOT_INITIALIZED__ = true;
        logger.debug(
          `${LOG_PREFIX} Weglot.initialize() called. currentLang after init:`,
          window.Weglot?.getCurrentLang(),
        );

        // Restore the user's language from localStorage. Weglot's own
        // cookie sometimes gets dropped across route groups (auth uses
        // a different (marketing) segment) — mirroring to localStorage
        // makes the choice survive every navigation. Fires AFTER
        // initialize so Weglot is ready to accept switchTo.
        try {
          const stored =
            window[WEGLOT_PREFERRED_LANG_KEY] ??
            window.localStorage.getItem(WEGLOT_LANG_STORAGE_KEY);
          const current = window.Weglot?.getCurrentLang();

          logger.debug(
            `${LOG_PREFIX} Restore check — stored:`,
            stored,
            "current:",
            current,
            "preferred key present?",
            !!window[WEGLOT_PREFERRED_LANG_KEY],
          );

          if (stored && stored !== current) {
            logger.debug(`${LOG_PREFIX} Switching to stored language:`, stored);
            window.Weglot?.switchTo(stored);
          } else {
            logger.debug(`${LOG_PREFIX} No switch needed`);
          }
        } catch (err) {
          logger.error(`${LOG_PREFIX} Error restoring language:`, err);
        }

        // Any subsequent language change (from our switcher or via any
        // future integration) writes the new value back to localStorage
        // so the next page load picks it up.
        window.Weglot?.on("languageChanged", (lang: string) => {
          logger.debug(`${LOG_PREFIX} Weglot languageChanged event:`, lang);
          try {
            window.localStorage.setItem(WEGLOT_LANG_STORAGE_KEY, lang);
            window[WEGLOT_PREFERRED_LANG_KEY] = lang;
            logger.debug(
              `${LOG_PREFIX} Persisted language to localStorage:`,
              lang,
            );
          } catch (err) {
            logger.error(`${LOG_PREFIX} Error persisting language:`, err);
          }
        });

        logger.debug(`${LOG_PREFIX} Dispatching weglot:initialized`);
        window.dispatchEvent(new CustomEvent("weglot:initialized"));
      }}
    />
  );
}
