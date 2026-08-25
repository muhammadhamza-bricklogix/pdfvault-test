"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  isEntitledSnapshot,
  setEntitledSnapshot,
} from "@/lib/client/hooks/billing/entitlement-cache";
import { useIsEntitlementAllowlisted } from "@/lib/client/hooks/billing/use-entitlement-allowlist";
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
  const allowlisted = useIsEntitlementAllowlisted();
  const result = useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: billingService.getSubscription,
    staleTime: 30_000,
  });

  // Mirror the entitlement flag into the module-level snapshot the
  // axios request interceptor reads. Allowlisted users are treated as
  // entitled regardless of what the backend snapshot says.
  useEffect(() => {
    if (allowlisted) {
      setEntitledSnapshot(true);

      return;
    }
    if (result.data) {
      setEntitledSnapshot(isEntitledSnapshot(result.data));
    }
  }, [allowlisted, result.data]);

  return result;
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

/**
 * Invoice history for the dashboard billing tab.
 */
export function useInvoicesQuery() {
  return useQuery({
    queryKey: billingKeys.invoices(),
    queryFn: billingService.listInvoices,
    staleTime: 60_000,
  });
}
