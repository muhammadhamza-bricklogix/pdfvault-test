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
 * Coverage:
 *   - `Promise.withResolvers` — Safari 17.4+. pdf.js uses it for its
 *      message-handler streams; missing it makes the stream reader return
 *      undefined and the next `for…of` over it throws.
 *   - `Object.hasOwn` — Safari 15.4+. pdf.js uses it in a few hot loops.
 *   - `structuredClone` — Safari 15.4+. pdf.js uses it for transferable
 *      operator-list copies; a JSON-based fallback is fine here because
 *      pdf.js only clones plain data (no DOM nodes, no Maps).
 *   - `Array.prototype.at` — Safari 15.4+. pdf.js v5 uses `arr.at(-1)`
 *      in several token / operator-list helpers.
 *   - `Array.prototype.findLast` / `findLastIndex` — Safari 15.4+. Used
 *      by pdf.js v5 in its text-layer normalization pass; absence is a
 *      candidate for the "`...t of e`" cryptic throw inside
 *      `getTextContent`.
 *   - `TypedArray.prototype.at` — same Safari floor as `Array#at`,
 *      different prototype chain. pdf.js calls `.at()` on typed arrays
 *      from the worker payload.
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

  // `at(idx)` — supports negative indexes counted from the end.
  const atPolyfill = function at<T>(
    this: ArrayLike<T>,
    n: number,
  ): T | undefined {
    const len = this.length;
    const idx = n < 0 ? len + n : n;

    return idx >= 0 && idx < len ? this[idx] : undefined;
  };

  if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      configurable: true,
      writable: true,
      value: atPolyfill,
    });
  }

  // Patch typed-array prototypes that pdf.js touches. Same shared base
  // (`%TypedArray%.prototype.at`) on standards-compliant runtimes, but the
  // older WebKit floors split them per concrete class.
  const TYPED_ARRAYS = [
    Uint8Array,
    Uint8ClampedArray,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
  ] as const;

  for (const TA of TYPED_ARRAYS) {
    if (TA && typeof TA.prototype.at !== "function") {
      Object.defineProperty(TA.prototype, "at", {
        configurable: true,
        writable: true,
        value: atPolyfill,
      });
    }
  }

  if (typeof Array.prototype.findLast !== "function") {
    Object.defineProperty(Array.prototype, "findLast", {
      configurable: true,
      writable: true,
      value: function findLast<T>(
        this: T[],
        cb: (value: T, index: number, arr: T[]) => unknown,
      ): T | undefined {
        for (let i = this.length - 1; i >= 0; i--) {
          if (cb(this[i] as T, i, this)) return this[i];
        }

        return undefined;
      },
    });
  }

  if (typeof Array.prototype.findLastIndex !== "function") {
    Object.defineProperty(Array.prototype, "findLastIndex", {
      configurable: true,
      writable: true,
      value: function findLastIndex<T>(
        this: T[],
        cb: (value: T, index: number, arr: T[]) => unknown,
      ): number {
        for (let i = this.length - 1; i >= 0; i--) {
          if (cb(this[i] as T, i, this)) return i;
        }

        return -1;
      },
    });
  }

  // `ReadableStream.prototype[Symbol.asyncIterator]` — Safari shipped
  // `ReadableStream` long before async-iteration on it (still missing in
  // some Safari 15/16 builds). pdf.js v5's `getTextContent` does
  // `for await (const v of readableStream)`, which looks up
  // `Symbol.asyncIterator` on the stream and trips on
  // `"undefined is not a function (near '...t of e...')"` when the
  // prototype lacks it. Polyfill walks the stream via `getReader()`.
  // This is the load-bearing fix that unblocks Edit Text on iOS Safari —
  // see skill log 2026-06-14 (d).
  const RS = (
    globalThis as unknown as {
      ReadableStream?: { prototype: Record<symbol, unknown> };
    }
  ).ReadableStream;

  if (RS && typeof RS.prototype[Symbol.asyncIterator] !== "function") {
    Object.defineProperty(RS.prototype, Symbol.asyncIterator, {
      configurable: true,
      writable: true,
      value: function asyncIterator(this: ReadableStream) {
        const reader = this.getReader();

        return {
          next(): Promise<IteratorResult<unknown>> {
            return reader.read() as Promise<IteratorResult<unknown>>;
          },
          return(value?: unknown): Promise<IteratorResult<unknown>> {
            reader.releaseLock();

            return Promise.resolve({
              value,
              done: true,
            } as IteratorResult<unknown>);
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        };
      },
    });
  }
}
