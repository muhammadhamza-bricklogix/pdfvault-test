// Use the LEGACY worker build. pdf.js v5's main build uses modern JS
// features (e.g. `for await...of`, `Promise.withResolvers`, `Array.findLast`)
// that older iOS Safari WebKit ships without — `getTextContent` throws
// `undefined is not a function (near '...t of e...')` on those devices.
// The legacy build transpiles those down to ES2017 and runs everywhere.
// Modern desktop pays a ~60KB delta; older mobile actually works.
// Keep this import string in lock-step with the runtime imports of
// `pdfjs-dist/legacy/build/pdf.mjs` elsewhere in the codebase.
export const PDFJS_WORKER_SRC = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
