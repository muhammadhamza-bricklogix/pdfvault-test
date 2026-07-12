"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/config/api-client";
import { billingKeys } from "@/lib/shared/constants/query-keys";

export type ChurnReason =
  | "unforeseen_circumstances"
  | "lacks_features_i_need"
  | "too_expensive"
  | "only_needed_it_once"
  | "too_buggy"
  | "switching_to_a_different_tool"
  | "other";

export interface CancellationFeedback {
  reason: ChurnReason;
  freeText?: string;
  rejectedThroughTier?: number;
}

export function useRecordOfferShownMutation() {
  return useMutation({
    mutationFn: async (input: { tier: number }) => {
      await apiClient.post("/billing/cancellation/offer-shown", input);
    },
  });
}

export function useAcceptDownsellMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tier: 1 | 2 }) => {
      await apiClient.post("/billing/cancellation/accept-downsell", input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

export function useFinalizeCancellationMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CancellationFeedback) => {
      await apiClient.post("/billing/subscription/cancel", input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
