"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/config/api-client";
import { billingKeys } from "@/lib/shared/constants/query-keys";

export interface CancelSubscriptionInput {
  cancelCode?: string;
  cancelDescription?: string;
}

/**
 * Requests cancellation of the current user's active subscription. The
 * backend translates the categorical + free-text feedback into a
 * Solidgate cancel code and calls the Subscriptions 2.0 cancel endpoint.
 * Local status flips to CANCELLED via the resulting
 * `subscription.cancelled` webhook, so we invalidate the subscription
 * cache once the request resolves and let the webhook path
 * authoritatively update state.
 */
export function useCancelSubscriptionMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CancelSubscriptionInput) => {
      await apiClient.post("/billing/subscription/cancel", input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

export function useRestoreSubscriptionMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/billing/subscription/restore");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
