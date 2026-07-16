// Shape mirrors the backend DTOs in
// pdf-viewer-backend/src/billing/dto/*.dto.ts. Keep both in sync when
// the schema changes; there is no auto-generated OpenAPI client yet.

export type PlanKind =
  | "TRIAL_MONTHLY"
  | "ANNUAL"
  | "DOWNSELL_1Y"
  | "DOWNSELL_2Y";

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "PAUSED"
  | "NONE";

export interface Plan {
  id: string;
  name: string;
  kind: PlanKind;
  trialAmountMinor: number | null;
  trialDays: number | null;
  recurringAmountMinor: number;
  intervalMonths: number;
  currency: string;
}

export interface SubscriptionSnapshot {
  entitled: boolean;
  status: SubscriptionStatus;
  planName: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelledButActive: boolean;
}

export interface CheckoutIntentRequest {
  planKind?: PlanKind;
  disclaimerVersion: string;
}

export interface CheckoutIntent {
  merchant: string;
  paymentIntent: string;
  signature: string;
  orderId: string;
  amountTodayMinor: number;
  amountRenewMinor: number;
  renewalDate: string;
  currency: string;
}

export interface Invoice {
  id: string;
  amountMinor: number;
  currency: string;
  status: "APPROVED" | "DECLINED" | "REFUNDED" | "PENDING";
  type: "TRIAL" | "RECURRING" | "DOWNSELL" | "REFUND" | "ONE_OFF";
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}
