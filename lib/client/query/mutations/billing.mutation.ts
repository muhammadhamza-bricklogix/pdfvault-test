"use client";

import type { CheckoutIntentRequest } from "@/lib/shared/types/billing.types";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { billingService } from "@/lib/shared/api/services/billing.service";
import { billingKeys } from "@/lib/shared/constants/query-keys";

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
