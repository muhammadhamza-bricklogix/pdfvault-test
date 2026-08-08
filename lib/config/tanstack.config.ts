import type { QueryClientConfig } from "@tanstack/react-query";

// Idempotent mutations (uploads, conversion jobs) retry up to 2 times with
// exponential backoff. Payment mutations are excluded at the call site via
// `retry: 0` to avoid double-charge risk.
function exponentialBackoff(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 2,
      retryDelay: exponentialBackoff,
    },
  },
};
