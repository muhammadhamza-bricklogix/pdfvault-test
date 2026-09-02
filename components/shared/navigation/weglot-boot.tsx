"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

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

const WEGLOT_CONFIG = {
  api_key: WEGLOT_API_KEY,
  originalLanguage: "en",
  destinationLanguages: "de,fr,es,pt,ar",
  subdirectory: true,
  switchers: [],
} as const;

function initWeglotOnce(): void {
  if (typeof window === "undefined") return;
  if (window.__WEGLOT_INITIALIZED__) return;
  if (!window.Weglot) return;

  window.Weglot.initialize({ ...WEGLOT_CONFIG });
  window.__WEGLOT_INITIALIZED__ = true;
}

/**
 * Loads the Weglot CDN script and initializes it once in subdirectory
 * mode. Weglot reads the URL path (`/de/...`, `/fr/...`) to pick the
 * target language and translates the DOM client-side.
 *
 * Deferred until AFTER React hydration:
 *   - `<Script strategy="lazyOnload">` waits for `window.onload` to fire
 *     (all resources loaded + DOM stable) before injecting the src. This
 *     guarantees React has finished hydrating before Weglot's SDK gets
 *     a chance to mutate `<html lang>` or DOM text — otherwise Weglot's
 *     mutations mid-hydration triggered React error #418 in prod
 *     (2026-09-02).
 *   - `hydrated` guard on the useEffect ensures the safety-net init
 *     path (client-side nav / HMR with Weglot already loaded) also
 *     only fires post-mount, never during render.
 *
 * Design notes:
 *   - No localStorage persistence — the URL is the source of truth.
 *     Our own middleware sets `lang_pref` cookie via the language
 *     switcher; Weglot doesn't need to duplicate that.
 *   - No language-restore logic — visiting `/de/edit` IS the language
 *     signal.
 *   - `switchers: []` disables Weglot's floating widget (we render our
 *     own `LanguageSwitcher` / `LandingLanguageSwitcher`).
 *
 * Silently no-ops when `NEXT_PUBLIC_WEGLOT_API_KEY` is unset.
 */
export function WeglotBoot() {
  const [hydrated, setHydrated] = useState(false);

  // Flip `hydrated` on the client only, after React has finished
  // mounting this component. Server-render always renders with
  // `hydrated=false` so the initial SSR HTML never contains anything
  // Weglot-conditional.
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Safety net for client-side navigation / HMR: if Weglot's script is
  // already on window but not initialized, init it now. Runs only
  // after hydration completes so it can't race React.
  useEffect(() => {
    if (!hydrated) return;
    if (!WEGLOT_API_KEY) return;
    initWeglotOnce();
  }, [hydrated]);

  if (!WEGLOT_API_KEY) return null;
  if (!hydrated) return null;

  return (
    <Script
      src="https://cdn.weglot.com/weglot.min.js"
      strategy="lazyOnload"
      onLoad={initWeglotOnce}
    />
  );
}
