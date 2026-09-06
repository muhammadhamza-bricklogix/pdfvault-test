import type { QueryClientConfig } from "@tanstack/react-query";

import { PAYWALL_CANCELLED_ERR_NAME } from "@/lib/client/hooks/billing/paywall-bus";

// Idempotent mutations (uploads, conversion jobs) retry up to 2 times with
// exponential backoff. Payment mutations are excluded at the call site via
// `retry: 0` to avoid double-charge risk.
function exponentialBackoff(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

/**
 * Global mutation retry predicate. Retries up to 2× with exponential
 * backoff for transient failures, BUT bails immediately on:
 *
 *   1. **PaywallCancelledError** — user closed the paywall. Retrying
 *      would re-open it (the axios pre-flight gate fires
 *      `requestPaywall()` on every attempt against a gated endpoint).
 *      QA 2026-09-06: Flatten → paywall → close → paywall opens again
 *      → close → paywall opens a third time. Root cause was
 *      `retry: 2` treating the cancel like a network hiccup.
 *
 * Add other explicit user-cancellation error classes here as they land
 * (AbortError, PaymentRequiredError, etc.) so a user's "no thanks"
 * click can never be re-interpreted as "try harder".
 */
function isPaywallCancelledError(error: unknown): boolean {
  // Walk both the error itself and its `cause` chain — some paths
  // wrap it in an `ApiError { cause: PaywallCancelledError }`, e.g.
  // an interceptor variant that pre-dates the passthrough guard in
  // `api-client.ts`. Walking the chain keeps the retry predicate
  // robust to future wrapping without touching this file again.
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth++) {
    const name = (current as { name?: string })?.name;

    if (name === PAYWALL_CANCELLED_ERR_NAME) return true;
    current = (current as { cause?: unknown })?.cause;
  }

  return false;
}

function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (isPaywallCancelledError(error)) return false;
  const name = (error as { name?: string })?.name;

  if (name === "AbortError") return false;

  return true;
}

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: shouldRetryMutation,
      retryDelay: exponentialBackoff,
    },
  },
};
