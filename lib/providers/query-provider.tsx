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

/**
 * Global TanStack Query observers → Sentry:
 *   - queryCache.onError:      breadcrumb + captured error tagged with query key
 *   - queryCache.onSuccess:    breadcrumb with query key (info-level)
 *   - mutationCache.onError:   captured error tagged with mutation key + variables shape
 *   - mutationCache.onSuccess: breadcrumb with mutation key
 *   - mutationCache.onMutate:  breadcrumb "started"
 */
function createInstrumentedClient(): QueryClient {
  return new QueryClient({
    ...queryClientConfig,
    queryCache: new QueryCache({
      onError: (error, query) => {
        const key = stringifyKey(query.queryKey);

        logger.captureError(error, "query", {
          queryKey: key,
          queryHash: query.queryHash,
        });
      },
      onSuccess: (_data, query) => {
        logger.breadcrumb("query", "query.success", {
          queryKey: stringifyKey(query.queryKey),
        });
      },
    }),
    mutationCache: new MutationCache({
      onMutate: (_variables, mutation) => {
        logger.breadcrumb("mutation", "mutation.start", {
          mutationKey: mutation.options.mutationKey
            ? stringifyKey(mutation.options.mutationKey)
            : "anonymous",
        });
      },
      onError: (error, _variables, _context, mutation) => {
        const key = mutation.options.mutationKey
          ? stringifyKey(mutation.options.mutationKey)
          : "anonymous";

        logger.captureError(error, "mutation", {
          mutationKey: key,
        });
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        logger.breadcrumb("mutation", "mutation.success", {
          mutationKey: mutation.options.mutationKey
            ? stringifyKey(mutation.options.mutationKey)
            : "anonymous",
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
