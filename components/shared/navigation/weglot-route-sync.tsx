"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

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
 * client-side route change. `switchTo(getCurrentLang())` is
 * intentionally idempotent — Weglot returns immediately if you're
 * already on that language, but it walks the DOM again and picks up
 * any nodes that arrived after init. Mount once at the app root.
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
      const current = window.Weglot?.getCurrentLang();

      if (!current) return;
      window.Weglot?.switchTo(current);
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
