import { installPdfJsPolyfills } from "./pdfjs-polyfills";

/**
 * Single entry point for loading pdfjs-dist at runtime.
 *
 * Guarantees:
 *   1. The Safari polyfills (`Promise.withResolvers`, `Object.hasOwn`,
 *      `structuredClone`) are installed BEFORE the pdf.js module factory
 *      runs and captures the global references.
 *   2. Every editor file goes through the same legacy build entry —
 *      `pdfjs-dist/legacy/build/pdf.mjs` — so we can't accidentally mix
 *      the modern build (which breaks on older iOS Safari WebKit).
 *
 * Always use this instead of `import("pdfjs-dist")` /
 * `import("pdfjs-dist/legacy/build/pdf.mjs")` directly.
 */
export async function loadPdfJs() {
  installPdfJsPolyfills();

  return import("pdfjs-dist/legacy/build/pdf.mjs");
}
