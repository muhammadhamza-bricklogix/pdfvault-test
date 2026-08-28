import type {
  CheckoutIntent,
  CheckoutIntentRequest,
  Invoice,
  Plan,
  SubscriptionSnapshot,
} from "@/lib/shared/types/billing.types";

import { getStoredGoogleClickIds } from "@/lib/client/analytics/google-click-id";
import { apiClient } from "@/lib/config/api-client";
import { BILLING } from "@/lib/shared/constants/endpoints";

async function listPlans(): Promise<Plan[]> {
  const { data } = await apiClient.get<Plan[]>(BILLING.PLANS);

  return data;
}

async function getSubscription(): Promise<SubscriptionSnapshot> {
  const { data } = await apiClient.get<SubscriptionSnapshot>(
    BILLING.SUBSCRIPTION,
  );

  return data;
}

async function createCheckoutIntent(
  input: CheckoutIntentRequest,
): Promise<CheckoutIntent> {
  // Enrich with whichever Google Ads click IDs were captured on the
  // landing URL (see `GoogleAdsClickBoot`). Explicit-input fields still
  // win — callers can override in tests. Undefined fields are omitted so
  // the JSON payload stays clean when the user didn't arrive via an ad.
  const stored = getStoredGoogleClickIds();
  const enriched: CheckoutIntentRequest = {
    ...(stored.gclid ? { gclid: stored.gclid } : {}),
    ...(stored.gbraid ? { gbraid: stored.gbraid } : {}),
    ...(stored.wbraid ? { wbraid: stored.wbraid } : {}),
    ...(stored.clickTimestamp ? { clickTimestamp: stored.clickTimestamp } : {}),
    ...input,
  };

  const { data } = await apiClient.post<CheckoutIntent>(
    BILLING.CHECKOUT_INTENT,
    enriched,
  );

  return data;
}

async function listInvoices(): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[]>(BILLING.INVOICES);

  return data;
}

async function syncSubscription(
  input: { subscriptionId?: string } = {},
): Promise<{ ok: true; synced: number }> {
  const { data } = await apiClient.post<{ ok: true; synced: number }>(
    "/billing/subscription/sync",
    input,
  );

  return data;
}

async function syncHistory(): Promise<{
  ok: true;
  subscriptions: number;
  payments: number;
}> {
  const { data } = await apiClient.post<{
    ok: true;
    subscriptions: number;
    payments: number;
  }>("/billing/history/sync");

  return data;
}

export const billingService = {
  listPlans,
  getSubscription,
  createCheckoutIntent,
  listInvoices,
  syncSubscription,
  syncHistory,
};
