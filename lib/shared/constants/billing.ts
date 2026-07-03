/**
 * Billing configuration — plan catalog + compliance copy that must survive
 * refactors because both FTC's Negative-Option rule and Visa/MC scheme rules
 * require it to be visible on the checkout screen.
 *
 * Plan IDs default to the environment (production Chargebee ItemPrice IDs go
 * in .env). Everything else is source-controlled so pricing changes ship in a
 * commit that reviewers can see.
 */

export const BILLING_CURRENCY = "USD";

export type BillingInterval = "week" | "month" | "6-months" | "year";

export interface BillingPlan {
  id: string;
  /** Chargebee item_price_id — resolved from env at runtime. */
  externalId: string | undefined;
  label: string;
  /** Charged today for trial plans; charged per interval otherwise. */
  price: number;
  /** Cents — the amount we'll actually authorise. */
  priceCents: number;
  /** Human blurb: "$0.99 for 7 days", "$24.99/month". */
  priceLabel: string;
  interval: BillingInterval;
  intervalCount: number;
  /** For trial plans only — the plan the trial converts INTO. */
  convertsToPlanId?: string;
  /** For trial plans — trial length in days. */
  trialDays?: number;
  /** Copy that must appear next to the CTA. Non-optional on purpose. */
  renewalDisclosure: string;
  features: string[];
}

const env = (name: string): string | undefined => {
  const value = process.env[name];

  return value && value.length > 0 ? value : undefined;
};

const TRIAL_LIMITED_ID = "trial-limited-7d";
const TRIAL_FULL_ID = "trial-full-7d";
const MONTHLY_STANDARD_ID = "monthly-standard";
const MONTHLY_PLUS_ID = "monthly-plus";
const MONTHLY_PRO_ID = "monthly-pro";

const disclosure = (
  trialPrice: string,
  renewalPrice: string,
  renewalCadence: string,
): string =>
  `You'll be charged ${trialPrice} today. On day 8 this converts to ${renewalPrice} ${renewalCadence} and renews automatically. Cancel any time from your billing dashboard — no questions asked.`;

export const BILLING_PLANS: Record<string, BillingPlan> = {
  [TRIAL_LIMITED_ID]: {
    id: TRIAL_LIMITED_ID,
    externalId: env("BILLING_TRIAL_LIMITED_PLAN_ID"),
    label: "7-day limited trial",
    price: 0.99,
    priceCents: 99,
    priceLabel: "$0.99 for 7 days",
    interval: "week",
    intervalCount: 1,
    trialDays: 7,
    convertsToPlanId: MONTHLY_STANDARD_ID,
    renewalDisclosure: disclosure("$0.99", "$19.99", "per month"),
    features: [
      "Edit up to 3 documents per day",
      "Standard conversions",
      "PDF sharing links",
    ],
  },
  [TRIAL_FULL_ID]: {
    id: TRIAL_FULL_ID,
    externalId: env("BILLING_TRIAL_FULL_PLAN_ID"),
    label: "7-day full-access trial",
    price: 1.99,
    priceCents: 199,
    priceLabel: "$1.99 for 7 days",
    interval: "week",
    intervalCount: 1,
    trialDays: 7,
    convertsToPlanId: MONTHLY_PLUS_ID,
    renewalDisclosure: disclosure("$1.99", "$24.99", "per month"),
    features: [
      "Unlimited edits",
      "OCR + batch conversions",
      "Priority processing",
      "PDF sharing links",
    ],
  },
  [MONTHLY_STANDARD_ID]: {
    id: MONTHLY_STANDARD_ID,
    externalId: env("BILLING_MONTHLY_STANDARD_PLAN_ID"),
    label: "Standard monthly",
    price: 19.99,
    priceCents: 1999,
    priceLabel: "$19.99/month",
    interval: "month",
    intervalCount: 1,
    renewalDisclosure:
      "$19.99 billed today and every month. Cancel any time from your billing dashboard.",
    features: [
      "Edit up to 3 documents per day",
      "Standard conversions",
      "PDF sharing links",
    ],
  },
  [MONTHLY_PLUS_ID]: {
    id: MONTHLY_PLUS_ID,
    externalId: env("BILLING_MONTHLY_PLUS_PLAN_ID"),
    label: "Plus monthly",
    price: 24.99,
    priceCents: 2499,
    priceLabel: "$24.99/month",
    interval: "month",
    intervalCount: 1,
    renewalDisclosure:
      "$24.99 billed today and every month. Cancel any time from your billing dashboard.",
    features: [
      "Unlimited edits",
      "OCR + batch conversions",
      "Priority processing",
      "PDF sharing links",
    ],
  },
  [MONTHLY_PRO_ID]: {
    id: MONTHLY_PRO_ID,
    externalId: env("BILLING_MONTHLY_PRO_PLAN_ID"),
    label: "Pro monthly",
    price: 29.99,
    priceCents: 2999,
    priceLabel: "$29.99/month",
    interval: "month",
    intervalCount: 1,
    renewalDisclosure:
      "$29.99 billed today and every month. Cancel any time from your billing dashboard.",
    features: [
      "Everything in Plus",
      "API access",
      "Advanced admin controls",
      "Dedicated support",
    ],
  },
} as const;

export const TRIAL_PLAN_IDS = [TRIAL_LIMITED_ID, TRIAL_FULL_ID] as const;
export const RECURRING_PLAN_IDS = [
  MONTHLY_STANDARD_ID,
  MONTHLY_PLUS_ID,
  MONTHLY_PRO_ID,
] as const;

/** Plans surfaced on the download gate — trials first, then a "skip trial". */
export const DOWNLOAD_GATE_PLAN_IDS: readonly string[] = [
  TRIAL_LIMITED_ID,
  TRIAL_FULL_ID,
  MONTHLY_PLUS_ID,
];

/** Plans surfaced on the /pricing page. */
export const PRICING_PAGE_PLAN_IDS: readonly string[] = [
  MONTHLY_STANDARD_ID,
  MONTHLY_PLUS_ID,
  MONTHLY_PRO_ID,
];

export const getPlan = (planId: string): BillingPlan | undefined =>
  BILLING_PLANS[planId];

/**
 * Master feature flag. Setting BILLING_ENABLED=false hides all billing UI —
 * pricing page, download gate, dashboard billing tab — and disables the
 * checkout API. Use this until Chargebee is provisioned to keep the UX
 * from showing "coming soon" errors to real users.
 */
export const isBillingEnabled = (): boolean =>
  process.env.BILLING_ENABLED === "true";

/**
 * NEXT_PUBLIC_BILLING_ENABLED mirrors BILLING_ENABLED so client components
 * can short-circuit without a round-trip. Keep the two in sync in .env.
 */
export const isBillingEnabledClient = (): boolean =>
  process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
