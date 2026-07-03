"use client";

import type { Entitlement } from "@/lib/shared/types/billing.types";
import type { Invoice } from "@/lib/shared/api/services/billing.service";

import { useQuery } from "@tanstack/react-query";

import { billingService } from "@/lib/shared/api/services/billing.service";
import { billingKeys } from "@/lib/shared/constants/query-keys";
import { emptyEntitlement } from "@/lib/shared/types/billing.types";

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Reads the current user's billing entitlement from the backend. Refreshed
 * on window focus because a webhook may have flipped `status` while the tab
 * was hidden (e.g. after redirect back from Chargebee hosted checkout).
 *
 * Unauthenticated / not-yet-provisioned users fall back to an empty
 * entitlement rather than erroring so consumers can render a stable UI.
 */
export function useEntitlementQuery(options?: { enabled?: boolean }) {
  return useQuery<Entitlement>({
    queryKey: billingKeys.entitlement(),
    queryFn: async () => {
      try {
        return await billingService.getEntitlement();
      } catch {
        return emptyEntitlement();
      }
    },
    enabled: options?.enabled,
    staleTime: ONE_MINUTE_MS,
    refetchOnWindowFocus: true,
  });
}

export function useInvoicesQuery(options?: { enabled?: boolean }) {
  return useQuery<Invoice[]>({
    queryKey: [...billingKeys.all, "invoices"],
    queryFn: () => billingService.listInvoices(),
    enabled: options?.enabled,
    staleTime: ONE_MINUTE_MS,
  });
}
