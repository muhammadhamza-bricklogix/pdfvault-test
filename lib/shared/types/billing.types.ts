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
  | "REDEMPTION"
  | "UNPAID"
  | "CANCELLED"
  | "EXPIRED"
  | "PAUSED"
  | "CREATED"
  | "PENDING"
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
  /**
   * Filename of the file the user was working with when the paywall
   * opened (source doc on convert/export, dashboard row for
   * Open/Download). Forwarded to Customer.io as `file_name` on the
   * `checkout_started` event so lifecycle emails can reference the doc
   * that motivated the checkout. Optional — omitted for paywall opens
   * with no document context (billing settings, identity popover).
   */
  fileName?: string;
  /**
   * Google Ads click identifiers captured off the landing URL by
   * `GoogleAdsClickBoot`. Backend persists whichever is present on the
   * subscription record, then uploads to Google Ads Offline Conversion
   * Import when the Solidgate webhook fires for the day-7 first
   * payment (conversion action 7733397743), day-45 rebill (7733408318),
   * and day-60 rebill (7733421050) events.
   *
   * Only one of `gclid` / `gbraid` / `wbraid` will normally be present
   * per landing — Google emits `gclid` on desktop web with 3rd-party
   * cookies allowed, `wbraid` on the web when they're blocked, and
   * `gbraid` on iOS app conversions. All three are forwarded so the
   * backend never has to guess which one Ads will accept.
   *
   * `clickTimestamp` is the ISO timestamp of the first landing that
   * carried a click ID — Google Ads' Offline Conversion Import requires
   * the click-time timestamp, NOT the conversion-time timestamp, on
   * upload.
   */
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  clickTimestamp?: string;
}

export interface AlternatePlanPricing {
  planKind: string;
  amountTodayMinor: number;
  amountRenewMinor: number;
  currency: string;
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
  /**
   * Pricing for every other selectable plan (annual / downsells) in
   * the same currency the user was quoted for the current plan. Lets
   * the paywall render every plan card without a second checkout-intent
   * round-trip.
   */
  alternatePlans?: AlternatePlanPricing[];
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
