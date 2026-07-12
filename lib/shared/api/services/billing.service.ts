import type {
  CheckoutIntent,
  CheckoutIntentRequest,
  Invoice,
  Plan,
  SubscriptionSnapshot,
} from "@/lib/shared/types/billing.types";

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
  const { data } = await apiClient.post<CheckoutIntent>(
    BILLING.CHECKOUT_INTENT,
    input,
  );

  return data;
}

async function listInvoices(): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[]>(BILLING.INVOICES);

  return data;
}

export const billingService = {
  listPlans,
  getSubscription,
  createCheckoutIntent,
  listInvoices,
};
