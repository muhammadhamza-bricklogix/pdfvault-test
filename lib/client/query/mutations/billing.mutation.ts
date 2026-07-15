"use client";

import type { CheckoutIntentRequest } from "@/lib/shared/types/billing.types";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { billingService } from "@/lib/shared/api/services/billing.service";
import { billingKeys } from "@/lib/shared/constants/query-keys";

/**
 * Pulls the caller's current Solidgate subscription state and mirrors
 * it into the local DB. Fired automatically on iframe `success` so the
 * dashboard reflects the new state without waiting for a webhook (the
 * webhook path is still the source of truth in production; this is a
 * belt-and-suspenders fallback that also makes local dev + demos work
 * without a public tunnel to Solidgate).
 */
export function useSyncSubscriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { subscriptionId?: string } = {}) =>
      billingService.syncSubscription(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

/**
 * Builds the signed Solidgate merchant-data envelope for the iframe.
 * Consumed exclusively by `PaywallModal` — no other component should
 * call this directly.
 */
export function useCreateCheckoutIntentMutation() {
  return useMutation({
    mutationFn: (input: CheckoutIntentRequest) =>
      billingService.createCheckoutIntent(input),
  });
}

/**
 * Refreshes the subscription snapshot after a successful checkout.
 * Called from the paywall's `onSuccess` iframe event so the entitlement
 * gate flips before the queued action retries.
 */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: billingKeys.all });
}
