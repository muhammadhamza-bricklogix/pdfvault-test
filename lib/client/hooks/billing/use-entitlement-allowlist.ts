"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo } from "react";

import { setAllowlistedSnapshot } from "@/lib/client/hooks/billing/entitlement-cache";
import { isAllowlistedEmail } from "@/lib/shared/constants/entitlement-allowlist";

/**
 * True when the current Clerk user has an email in
 * `ENTITLEMENT_ALLOWLIST`. Consumed by every entitlement read site
 * (useIsEntitled, usePaywall, useSubscriptionQuery mirror) so a single
 * allowlist decision flows through the whole paywall chain.
 *
 * Also mirrors the value into the module-level snapshot so non-React
 * callers (axios interceptor, ensureFreshEntitlement) skip the network
 * check the moment Clerk resolves to an allowlisted user.
 */
export function useIsEntitlementAllowlisted(): boolean {
  const { user } = useUser();

  const allowlisted = useMemo(() => {
    if (!user) return false;
    for (const record of user.emailAddresses) {
      if (isAllowlistedEmail(record.emailAddress)) return true;
    }

    return false;
  }, [user]);

  useEffect(() => {
    setAllowlistedSnapshot(allowlisted);
  }, [allowlisted]);

  return allowlisted;
}
