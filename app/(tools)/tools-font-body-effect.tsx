"use client";

import { useEffect } from "react";

/**
 * Attach the (tools)-layout font `.variable` classes to `document.body`
 * on mount so HeroUI Modal / React Aria portals — which render OUTSIDE
 * the layout wrapper via `createPortal(document.body)` — can still
 * resolve `var(--font-dancing-script)`, `var(--font-allura)`, etc.
 *
 * Without this the signature type-picker in `SignatureModal` (both
 * W-9 and PDF composer) rendered "adsf" in the fallback sans font for
 * Allura / Sacramento / Pacifico — the CSS vars only existed on the
 * layout's wrapper `<div>`, not on the portal's DOM subtree
 * (QA 2026-09-07). Dancing Script "worked" only because
 * `styles/globals.css` had a `:root { --font-dancing-script:
 * 'Dancing Script', cursive }` fallback that matched a system-
 * installed font — the other 4 aren't system-installed.
 *
 * Classes are removed on unmount so landing / marketing routes never
 * inherit them and the LCP-preserving lazy-load intent is respected.
 */
export function ToolsFontBodyEffect({
  classNames,
}: {
  /** Space-separated list of next/font `.variable` classes. */
  classNames: string;
}) {
  useEffect(() => {
    const list = classNames.split(/\s+/).filter(Boolean);

    if (list.length === 0) return;
    for (const cls of list) document.body.classList.add(cls);

    return () => {
      for (const cls of list) document.body.classList.remove(cls);
    };
  }, [classNames]);

  return null;
}
