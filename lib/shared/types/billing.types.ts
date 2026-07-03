export type EntitlementStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired";

export interface Entitlement {
  planId: string | null;
  status: EntitlementStatus;
  /** Unix ms — end of the current paid period; access continues until then. */
  currentPeriodEnd: number | null;
  /** Unix ms — when the trial converts (if trialing). */
  trialEndsAt: number | null;
  /** True while a cancel is queued but the period hasn't ended yet. */
  cancelAtPeriodEnd: boolean;
  /** Last time this was written by a webhook. */
  updatedAt: number;
}

/** What we consider "user can use paid features right now." */
export const ACTIVE_STATUSES: readonly EntitlementStatus[] = [
  "trialing",
  "active",
  "past_due",
];

export const emptyEntitlement = (): Entitlement => ({
  planId: null,
  status: "none",
  currentPeriodEnd: null,
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  updatedAt: Date.now(),
});

export const isEntitlementActive = (
  e: Entitlement | null | undefined,
): boolean => {
  if (!e) {
    return false;
  }

  if (!ACTIVE_STATUSES.includes(e.status)) {
    return false;
  }

  if (e.currentPeriodEnd && e.currentPeriodEnd < Date.now()) {
    return false;
  }

  return true;
};
