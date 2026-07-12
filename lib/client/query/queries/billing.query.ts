"use client";

import { useQuery } from "@tanstack/react-query";

import { billingService } from "@/lib/shared/api/services/billing.service";
import { billingKeys } from "@/lib/shared/constants/query-keys";

/**
 * Reads the current user's subscription snapshot. Consumed by the paywall
 * precheck (`useRequireEntitlement`) and by the billing dashboard.
 *
 * `staleTime` is short (30s) so a successful checkout flips the local
 * cache quickly without waiting for the next mount. The paywall modal
 * also invalidates this key on success.
 */
export function useSubscriptionQuery() {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: billingService.getSubscription,
    staleTime: 30_000,
  });
}

/**
 * Plan catalog for the paywall's comparison card. Public endpoint, so
 * we skip auth and cache generously — pricing rarely changes.
 */
export function usePlansQuery() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: billingService.listPlans,
    staleTime: 5 * 60_000,
  });
}
