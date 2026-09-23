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
// `excludedBlocksSelector` is empty on the merchant dashboard. Passing
// `excludeBlocks` here fills that gap client-side and makes the fence
// markers actually load-bearing.
//
// Verified on staging 2026-09-23 via Playwright: fence + this config →
// paywall stays open on `/de/dashboard` when Annual is clicked; without
// this config → `Application error: a client-side exception has
// occurred` blank page (repro from user report).
const WEGLOT_EXCLUDE_BLOCKS = [
  { value: ".wg-notranslate" },
  { value: ".notranslate" },
  { value: '[translate="no"]' },
];

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
    excludeBlocks: WEGLOT_EXCLUDE_BLOCKS,
  });
  window.__WEGLOT_INITIALIZED__ = true;
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
