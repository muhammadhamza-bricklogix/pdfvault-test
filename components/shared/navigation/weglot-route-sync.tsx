"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { WEGLOT_LANG_STORAGE_KEY } from "./weglot-loader";

/**
 * Weglot loads a MutationObserver on init to catch dynamically-added
 * DOM nodes, but Next.js App Router client-side navigation replaces
 * whole subtrees fast enough that Weglot sometimes ships the new
 * content in the source language before it observes the change. The
 * symptom the user hits: switch language on `/`, click into
 * `/convert/pdf-to-word` (or any other tab), and the destination page
 * renders in English until a manual refresh.
 *
 * Fix: watch pathname + search-params and re-run Weglot on every
 * client-side route change. First we restore the persisted language
 * (in case Weglot fell back to English), then we force a DOM re-scan
 * so any newly-mounted content is translated.
 *
 * `switchTo(getCurrentLang())` is intentionally idempotent — Weglot
 * returns immediately if you're already on that language, but it walks
 * the DOM again and picks up any nodes that arrived after init. Mount
 * once at the app root.
 *
 * If Weglot isn't loaded (e.g. `NEXT_PUBLIC_WEGLOT_API_KEY` unset),
 * `window.Weglot` is undefined and this effect is a no-op — safe on
 * every deploy shape.
 */
export function WeglotRouteSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = () => {
      const w = window.Weglot;

      if (!w) return;

      let current = w.getCurrentLang();

      // Restore the user's persisted language if Weglot has reverted to
      // English (e.g. after a route change where its cookie was missing).
      try {
        const stored = window.localStorage.getItem(WEGLOT_LANG_STORAGE_KEY);

        if (stored && stored !== current) {
          w.switchTo(stored);
          current = stored;
        }
      } catch {
        // localStorage disabled / private mode — ignore.
      }

      // Nothing more to do for English; the source copy is already correct.
      if (!current || current === "en") return;

      // Prefer `search()` when the CDN bundle exposes it — walks the
      // DOM for untranslated nodes without a visible flash.
      // `switchTo(current)` short-circuits when target == current, so
      // it can't be used to force a re-scan. Fallback: switch to
      // English and back to force a full re-translation cycle.
      if (typeof w.search === "function") {
        w.search();
      } else {
        w.switchTo("en");
        w.switchTo(current);
      }
    };

    if (window.Weglot) {
      run();
    } else {
      // First mount before Weglot's script finishes loading — wait for
      // the `weglot:initialized` event the loader dispatches.
      window.addEventListener("weglot:initialized", run, { once: true });

      return () => window.removeEventListener("weglot:initialized", run);
    }
  }, [pathname, searchParams]);

  return null;
}
