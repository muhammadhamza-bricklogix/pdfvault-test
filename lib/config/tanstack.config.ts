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
function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const name = (error as { name?: string })?.name;

  if (name === PAYWALL_CANCELLED_ERR_NAME) return false;
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
