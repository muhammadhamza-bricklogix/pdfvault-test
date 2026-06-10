/**
 * Polyfills required by pdfjs-dist v5 on older iOS Safari WebKit.
 *
 * pdf.js v5 — even its `legacy/` build — calls modern JS APIs that older
 * WebKit versions don't ship. On those devices `getTextContent` throws
 * `"undefined is not a function (near '...t of e...')"` deep inside a
 * recursive parser and the entire text layer goes blank.
 *
 * Apply these polyfills BEFORE the first `await import("pdfjs-dist/...")`
 * call. `load-pdfjs.ts` does this for every dynamic import in the editor.
 *
 * Specifically:
 *   - `Promise.withResolvers` — Safari 17.4+. pdf.js uses it for its
 *      message-handler streams; missing it makes the stream reader return
 *      undefined and the next `for…of` over it throws.
 *   - `Object.hasOwn` — Safari 15.4+. pdf.js uses it in a few hot loops.
 *   - `structuredClone` — Safari 15.4+. pdf.js uses it for transferable
 *      operator-list copies; a JSON-based fallback is fine here because
 *      pdf.js only clones plain data (no DOM nodes, no Maps).
 *
 * These are no-ops on any browser that already implements the API.
 */
export function installPdfJsPolyfills(): void {
  if (typeof globalThis === "undefined") return;

  const g = globalThis as unknown as {
    Promise: PromiseConstructor & {
      withResolvers?: <T>() => {
        promise: Promise<T>;
        resolve: (value: T | PromiseLike<T>) => void;
        reject: (reason?: unknown) => void;
      };
    };
    Object: ObjectConstructor & {
      hasOwn?: (obj: object, key: PropertyKey) => boolean;
    };
    structuredClone?: <T>(value: T) => T;
  };

  if (typeof g.Promise.withResolvers !== "function") {
    g.Promise.withResolvers = function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, resolve, reject };
    };
  }

  if (typeof g.Object.hasOwn !== "function") {
    g.Object.hasOwn = (obj: object, key: PropertyKey): boolean =>
      Object.prototype.hasOwnProperty.call(obj, key);
  }

  if (typeof g.structuredClone !== "function") {
    g.structuredClone = function structuredCloneFallback<T>(value: T): T {
      // pdf.js only structuredClones plain operator-list data — no DOM,
      // no Maps/Sets, no typed-array transfer. JSON round-trip suffices.
      if (value === undefined) return value;

      return JSON.parse(JSON.stringify(value)) as T;
    };
  }
}
