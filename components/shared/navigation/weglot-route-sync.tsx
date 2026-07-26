"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { logger } from "@/lib/shared/utils/logger";

import { WEGLOT_LANG_STORAGE_KEY } from "./weglot-loader";

const LOG_PREFIX = "[WeglotRouteSync]";

/**
 * Force Weglot to re-scan the current DOM and translate any nodes that
 * arrived after the last scan. Next.js App Router inserts new page
 * content across multiple frames, so a single scan often misses nodes.
 * We run an immediate scan plus delayed scans to catch late renders.
 */
function rescanWeglot(currentLang: string): (() => void) | undefined {
  const w = window.Weglot;

  if (!w || currentLang === "en") return undefined;

  const runScan = (delayLabel: string) => {
    logger.debug(`${LOG_PREFIX} rescan (${delayLabel}) for lang:`, currentLang);
    if (typeof w.search === "function") {
      w.search();
    } else {
      logger.debug(`${LOG_PREFIX} fallback en -> ${currentLang}`);
      w.switchTo("en");
      w.switchTo(currentLang);
    }
  };

  // Immediate scan for already-committed nodes.
  runScan("immediate");

  // Delayed scans catch server-component HTML that streams in after the
  // pathname changes (e.g. dashboard inner pages).
  const timeouts = [50, 150, 350].map((delay) =>
    window.setTimeout(() => runScan(`${delay}ms`), delay),
  );

  return () => {
    timeouts.forEach((id) => window.clearTimeout(id));
  };
}

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
 * Mount once at the app root.
 */
export function WeglotRouteSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    logger.debug(
      `${LOG_PREFIX} Route changed — pathname:`,
      pathname,
      "search:",
      searchParams?.toString(),
    );

    let cleanupRescan: (() => void) | undefined;

    const run = () => {
      const w = window.Weglot;

      if (!w) {
        logger.debug(`${LOG_PREFIX} window.Weglot not available yet`);

        return;
      }

      let current = w.getCurrentLang();

      logger.debug(`${LOG_PREFIX} currentLang before restore:`, current);

      // Restore the user's persisted language if Weglot has reverted to
      // English (e.g. after a route change where its cookie was missing).
      try {
        const stored = window.localStorage.getItem(WEGLOT_LANG_STORAGE_KEY);

        logger.debug(
          `${LOG_PREFIX} stored language from localStorage:`,
          stored,
        );

        if (stored && stored !== current) {
          logger.debug(`${LOG_PREFIX} Restoring to stored language:`, stored);
          w.switchTo(stored);
          current = stored;
        } else {
          logger.debug(`${LOG_PREFIX} No restore needed`);
        }
      } catch (err) {
        logger.error(`${LOG_PREFIX} Error reading localStorage:`, err);
      }

      if (!current || current === "en") {
        logger.debug(
          `${LOG_PREFIX} Current is English or undefined — skipping DOM rescan`,
        );

        return;
      }

      // Defer the rescan slightly so React can commit/paint the new page.
      const raf = window.requestAnimationFrame(() => {
        cleanupRescan = rescanWeglot(current);
      });

      return () => {
        window.cancelAnimationFrame(raf);
        if (cleanupRescan) cleanupRescan();
      };
    };

    if (window.Weglot) {
      return run();
    }

    // First mount before Weglot's script finishes loading — wait for
    // the `weglot:initialized` event the loader dispatches.
    logger.debug(
      `${LOG_PREFIX} Weglot not ready — waiting for weglot:initialized`,
    );
    window.addEventListener("weglot:initialized", run, { once: true });

    return () => window.removeEventListener("weglot:initialized", run);
  }, [pathname, searchParams]);

  return null;
}
