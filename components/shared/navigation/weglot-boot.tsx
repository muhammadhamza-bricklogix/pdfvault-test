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
        excludeBlocks?: Array<{ value: string }>;
      }) => void;
      switchTo?: (lang: string) => void;
      getCurrentLang?: () => string | undefined;
      options?: {
        excluded_blocks?: Array<{ value: string }>;
        excludedBlocksSelector?: string;
        [key: string]: unknown;
      };
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    __WEGLOT_INITIALIZED__?: boolean;
  }
}

// Selectors Weglot must skip. Load-bearing: without this the paywall
// modal (marked `class="notranslate wg-notranslate" translate="no"`)
// still gets translated by Weglot's MutationObserver, and any React
// re-render inside the modal (e.g. clicking the Annual plan card)
// crashes with `NotFoundError: Failed to execute 'removeChild' on
// 'Node': The node to be removed is not a child of this node.` — React
// tries to remove text nodes Weglot has already swapped.
//
// Weglot ignores the class / `translate="no"` markers by DEFAULT on the
// "Other" technology integration (`technology_id: 12`) because
// `excludedBlocksSelector` is empty on the merchant dashboard. We fill
// that gap client-side — but Weglot v4's `initialize()` silently drops
// unrecognised properties from its config object, so passing
// `excludeBlocks` to `initialize()` alone is a no-op (verified on
// staging 2026-09-23: chunk contained the code but
// `Weglot.options.excluded_blocks` still resolved to `[]`).
//
// The only shape that actually sticks is mutating `Weglot.options`
// directly AFTER init. Both the array (`excluded_blocks`) and the CSS
// selector string (`excludedBlocksSelector`) are set — Weglot's
// MutationObserver reads whichever is populated for the current
// document mode.
const WEGLOT_EXCLUDE_BLOCKS = [
  { value: ".wg-notranslate" },
  { value: ".notranslate" },
  { value: '[translate="no"]' },
];
const WEGLOT_EXCLUDE_BLOCKS_SELECTOR =
  '.wg-notranslate, .notranslate, [translate="no"]';

function applyExcludeBlocks(): void {
  if (typeof window === "undefined") return;
  const W = window.Weglot;

  if (!W) return;
  W.options = W.options ?? {};
  W.options.excluded_blocks = WEGLOT_EXCLUDE_BLOCKS;
  W.options.excludedBlocksSelector = WEGLOT_EXCLUDE_BLOCKS_SELECTOR;
}

function initWeglotOnce(): void {
  if (typeof window === "undefined") return;
  if (window.__WEGLOT_INITIALIZED__) return;
  if (!window.Weglot) return;

  window.Weglot.initialize({
    api_key: WEGLOT_API_KEY,
    originalLanguage: "en",
    destinationLanguages: "de,fr,es,pt,ar",
    subdirectory: true,
    switchers: [] as unknown[],
  });
  window.__WEGLOT_INITIALIZED__ = true;

  // Mutate options AFTER init. `initialize()` overwrites `options` with
  // the merchant-dashboard config, so any pre-init mutation is lost.
  // Post-init assignment is the shape verified working in-browser
  // 2026-09-23 (Playwright repro: paywall stays open, Annual click
  // transitions cleanly, zero errors captured).
  applyExcludeBlocks();

  // Belt-and-braces: Weglot also emits `languageChanged` after every
  // switchTo() call, and internally re-reads `options.excluded_blocks`
  // for the next translation pass. Re-applying on that event keeps the
  // fence honoured across manual dropdown-driven language switches.
  try {
    window.Weglot?.on?.("languageChanged", applyExcludeBlocks);
  } catch {
    // `on` isn't guaranteed on every Weglot build; failing quietly is
    // acceptable — the post-init assignment above is the load-bearing
    // path.
  }
}

// Re-added 2026-09-02 after apex DNS was moved off Weglot's Cloudflare
// proxy to stop the 429 quota exhaustion (see spec
// 2026-09-02-locale-urls-geo-defaulting.md). With the proxy no longer
// in front of every request, the SDK is the only translation path
// until the CloudFront Reverse Proxy behaviors are deployed. Once
// those behaviors are live for /de|fr|es|pt|ar/*, remove this mount
// again to avoid the double-init that produced React #418.
export function WeglotBoot() {
  // Safety net for client-side navigation / HMR: if Weglot's script is
  // already on window but not initialized, init it now.
  useEffect(() => {
    if (!WEGLOT_API_KEY) return;
    initWeglotOnce();
  }, []);

  if (!WEGLOT_API_KEY) return null;

  // `afterInteractive` emits the <script> in SSR HTML and executes it
  // after Next.js hydrates. `lazyOnload` skips SSR entirely, so the
  // Weglot script would never appear in the initial payload — Weglot
  // then can't translate anything until whatever runtime injection
  // Next.js decides to run. React #418 (the reason we previously
  // preferred lazyOnload) only fires when Weglot's proxy ALSO injects
  // the same script server-side; with the proxy no longer in front,
  // the SDK is the ONLY loader and there's nothing to race against.
  return (
    <Script
      src="https://cdn.weglot.com/weglot.min.js"
      strategy="afterInteractive"
      onLoad={initWeglotOnce}
    />
  );
}
