"use client";

import { useEffect } from "react";

const ERUDA_URL = "https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.js";
const STORAGE_KEY = "pdfedits:mobile-debug";

/**
 * Lazy-loads the Eruda mobile devtools panel when `?debug=1` (or `?debug=eruda`)
 * is in the URL, or when `localStorage["pdfedits:mobile-debug"] === "1"`.
 *
 * Once activated, the choice is sticky for the tab (sessionStorage) so the
 * floating "console" button survives client-side navigations. Pass
 * `?debug=0` to clear.
 *
 * Why this exists: on a real iPhone you can't open browser devtools to read
 * `console.log`. Eruda renders an in-page console / network / DOM inspector
 * triggered by a small floating button — so the user can debug PDF load
 * failures without wiring the phone to a Mac.
 */
export function useMobileDebug() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const debugParam = params.get("debug");

    if (debugParam === "0" || debugParam === "off") {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* sessionStorage may be unavailable */
      }

      return;
    }

    let active = debugParam !== null;

    if (!active) {
      try {
        active = window.sessionStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        /* sessionStorage may be unavailable */
      }
    }

    if (!active) return;

    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* sessionStorage may be unavailable */
    }

    // Avoid double-loading on remount.
    const w = window as unknown as { eruda?: { init: () => void } };

    if (w.eruda) {
      w.eruda.init();

      return;
    }

    const script = document.createElement("script");

    script.src = ERUDA_URL;
    script.async = true;
    script.onload = () => {
      const ew = window as unknown as { eruda?: { init: () => void } };

      ew.eruda?.init();
    };
    document.head.appendChild(script);
  }, []);
}
