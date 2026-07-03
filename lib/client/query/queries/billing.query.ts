"use client";

import type { Entitlement } from "@/lib/shared/types/billing.types";

import { useQuery } from "@tanstack/react-query";

import { billingKeys } from "@/lib/shared/constants/query-keys";
import { emptyEntitlement } from "@/lib/shared/types/billing.types";

const ONE_MINUTE_MS = 60 * 1000;

async function fetchEntitlement(): Promise<Entitlement> {
  const res = await fetch("/api/billing/entitlement", { cache: "no-store" });

  if (!res.ok) {
    return emptyEntitlement();
  }

  return (await res.json()) as Entitlement;
}

/**
 * Reads the current user's billing entitlement. Refreshed on window focus
 * because a webhook may have flipped `status` while the tab was hidden
 * (e.g. after redirect back from Chargebee hosted checkout).
 */
export function useEntitlementQuery(options?: { enabled?: boolean }) {
  return useQuery<Entitlement>({
    queryKey: billingKeys.entitlement(),
    queryFn: fetchEntitlement,
    enabled: options?.enabled,
    staleTime: ONE_MINUTE_MS,
    refetchOnWindowFocus: true,
  });
}
