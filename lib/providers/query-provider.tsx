"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";

import { queryClientConfig } from "@/lib/config/tanstack.config";
import { logger } from "@/lib/shared/utils/logger";

type QueryProviderProps = {
  children: React.ReactNode;
};

function stringifyKey(key: readonly unknown[]): string {
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
}

function mutationKeyLabel(key: readonly unknown[] | undefined): string {
  if (!key) return "anonymous";

  return stringifyKey(key);
}

/**
 * Global TanStack Query observers → Sentry. Success paths reuse the
 * `queryHash` string TanStack already precomputes; error paths pay the
 * `JSON.stringify` cost so the failing key is visible in the report.
 */
function createInstrumentedClient(): QueryClient {
  return new QueryClient({
    ...queryClientConfig,
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.captureError(error, "query", {
          queryKey: stringifyKey(query.queryKey),
          queryHash: query.queryHash,
        });
      },
      onSuccess: (_data, query) => {
        logger.breadcrumb("query", "query.success", {
          queryHash: query.queryHash,
        });
      },
    }),
    mutationCache: new MutationCache({
      onMutate: (_variables, mutation) => {
        logger.breadcrumb("mutation", "mutation.start", {
          mutationKey: mutationKeyLabel(mutation.options.mutationKey),
        });
      },
      onError: (error, _variables, _context, mutation) => {
        logger.captureError(error, "mutation", {
          mutationKey: mutationKeyLabel(mutation.options.mutationKey),
        });
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        logger.breadcrumb("mutation", "mutation.success", {
          mutationKey: mutationKeyLabel(mutation.options.mutationKey),
        });
      },
    }),
  });
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(createInstrumentedClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
