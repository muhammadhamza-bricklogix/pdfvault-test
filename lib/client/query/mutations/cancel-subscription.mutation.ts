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

/**
 * Restores a cancelled-but-still-active subscription. The backend
 * returns `{ ok: true, message?: string }`:
 *   - `message` present → the local row was a phantom (Solidgate 404'd
 *     during the restore call) and the backend cleaned it up. The
 *     caller should show `message` to the user so they understand why
 *     the state changed without a real "renew" happening.
 *   - `message` absent → normal restore succeeded, subscription is
 *     ACTIVE again on the next query tick.
 */
export interface RestoreResult {
  ok: true;
  message?: string;
}

export function useRestoreSubscriptionMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<RestoreResult> => {
      const { data } = await apiClient.post<RestoreResult>(
        "/billing/subscription/restore",
      );

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
