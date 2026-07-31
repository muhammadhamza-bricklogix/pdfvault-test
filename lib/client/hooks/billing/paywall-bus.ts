/**
 * Module-scoped event bus that lets non-React code (axios interceptors,
 * plain async utilities) trigger the paywall modal without needing a
 * React context. Kept tiny on purpose — no dependencies, no external
 * emitter library.
 *
 * Flow:
 *   1. Axios interceptor sees a gated request against a non-entitled
 *      user and calls `requestPaywall()`.
 *   2. `requestPaywall()` returns a promise that resolves `true` on
 *      payment success, `false` when the user closes the modal.
 *   3. PaywallProvider registers a handler via `setPaywallHandler()`
 *      on mount; the handler opens the modal and pipes the outcome
 *      back into the promise chain.
 *   4. The interceptor waits on the promise, then either releases the
 *      request (entitlement should now be true) or rejects with a
 *      well-known error the caller can toast.
 */

export type PaywallOutcome = "success" | "cancelled";

/**
 * Optional preview shown at the top of the paywall modal so the user
 * knows exactly what they're about to unlock. Populated by convert /
 * export flows that hold the source file in hand; the axios
 * interceptor path leaves it undefined and the modal falls back to its
 * plain plan-picker layout.
 */
export interface PaywallPreview {
  /** Display filename, e.g. "1_CleanStack.docx". */
  filename: string;
  /** Source file extension, e.g. "docx", "xlsx", "pdf". Lower-case. */
  sourceExt: string;
  /** Target extension the user is trying to produce, e.g. "pdf",
   *  "docx", "png". Lower-case. */
  targetExt: string;
}

export interface PaywallRequestOptions {
  /**
   * Hide the entire left "your document is ready" preview column and
   * render the plan picker on its own. Used by billing settings ("Add
   * billing method") where there is no document context — the generic
   * blurred card would just be confusing there.
   */
  hidePreview?: boolean;
}

type PaywallHandler = (
  preview?: PaywallPreview,
  options?: PaywallRequestOptions,
) => Promise<PaywallOutcome>;

let handler: PaywallHandler | null = null;

/**
 * PaywallProvider registers itself here on mount. `null` on unmount
 * so a stale handler doesn't outlive the component tree during HMR.
 */
export function setPaywallHandler(next: PaywallHandler | null): void {
  handler = next;
}

/**
 * Called from anywhere — usually the axios request interceptor. If no
 * handler is registered (SSR or early boot), resolves `cancelled`
 * immediately so callers can fall through gracefully.
 *
 * Pass `preview` when the caller has file metadata to show above the
 * plan picker so the user can see the file they're about to unlock.
 * Pass `options.hidePreview` to suppress the preview column entirely
 * (settings-triggered opens where no document context exists).
 */
export function requestPaywall(
  preview?: PaywallPreview,
  options?: PaywallRequestOptions,
): Promise<PaywallOutcome> {
  if (!handler) return Promise.resolve("cancelled");

  return handler(preview, options);
}

/**
 * Thrown by the axios interceptor when a user dismisses the paywall
 * without paying. Consumers can identify this via `err.name === PAYWALL_CANCELLED_ERR_NAME`
 * so their toast reads "cancelled" instead of "network error".
 */
export const PAYWALL_CANCELLED_ERR_NAME = "PaywallCancelledError";

export class PaywallCancelledError extends Error {
  constructor() {
    super("Payment required");
    this.name = PAYWALL_CANCELLED_ERR_NAME;
  }
}
