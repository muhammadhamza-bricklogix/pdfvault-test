"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setEntitledSnapshot } from "@/lib/client/hooks/billing/entitlement-cache";
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
    onSuccess: async () => {
      // Immediate-revoke: cancel = trial ends now too, no downloads / no
      // conversions post-cancel. Backend already flipped status to
      // CANCELLED. The paywall gate reads a module-level snapshot via
      // `ensureFreshEntitlement`; that fast-path returns `true` until
      // the subscription query re-fetches AND its mirror effect runs.
      // Reported 2026-07-23: users cancelled but kept downloading in
      // the seconds after because the snapshot was still `true`.
      setEntitledSnapshot(false);
      qc.removeQueries({ queryKey: billingKeys.all });
      await qc.refetchQueries({ queryKey: billingKeys.subscription() });
    },
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

export interface HardCancelResult {
  ok: true;
  solidgateStatus: "cancelled" | "not_found" | "error";
}

/**
 * Force-cancel + wipe the local subscription row. Escape hatch for a
 * stuck state (declined trial, phantom row, Solidgate mismatch).
 * Attempts to cancel at Solidgate but always cleans up locally so the
 * user can start fresh. `solidgateStatus` reports the outbound result
 * so the caller can toast the truth.
 */
export function useHardCancelSubscriptionMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<HardCancelResult> => {
      const { data } = await apiClient.post<HardCancelResult>(
        "/billing/subscription/hard-cancel",
      );

      return data;
    },
    onSuccess: async () => {
      // Nuke the cached data outright instead of just invalidating.
      // Some subscribers (e.g. usePaywallGuard's snapshot mirror) read
      // React Query cache directly and race the invalidate/refetch
      // cycle, showing stale state for a beat after Close. Removing
      // the cache entry forces every subscriber into a "loading"
      // state → the very next network round-trip drives the true
      // NONE-status render.
      setEntitledSnapshot(false);
      qc.removeQueries({ queryKey: billingKeys.all });
      await qc.refetchQueries({ queryKey: billingKeys.subscription() });
    },
  });
}
