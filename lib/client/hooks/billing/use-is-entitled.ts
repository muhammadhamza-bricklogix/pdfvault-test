"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { isEntitledSnapshot } from "@/lib/client/hooks/billing/entitlement-cache";
import { useIsEntitlementAllowlisted } from "@/lib/client/hooks/billing/use-entitlement-allowlist";
import { billingService } from "@/lib/shared/api/services/billing.service";
import { billingKeys } from "@/lib/shared/constants/query-keys";

/**
 * Reactive "does the current user have paid access?" flag.
 *
 * Safe to call from surfaces outside the app shell (e.g. the landing
 * header) — the query is gated on `isSignedIn`, so signed-out visitors
 * never trigger a 401 or a paywall dispatch. Signed-in users share the
 * same TanStack Query cache as the app's `useSubscriptionQuery`, so
 * there is no duplicate network round-trip.
 */
export function useIsEntitled(): boolean {
  const { isSignedIn } = useAuth();
  const allowlisted = useIsEntitlementAllowlisted();
  const { data } = useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: billingService.getSubscription,
    staleTime: 30_000,
    enabled: !!isSignedIn,
  });

  if (allowlisted) return true;

  return isEntitledSnapshot(data);
}
