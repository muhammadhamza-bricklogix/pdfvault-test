import type { Entitlement } from "@/lib/shared/types/billing.types";

import { apiClient } from "@/lib/config/api-client";
import { BILLING } from "@/lib/shared/constants/endpoints";

export interface CheckoutRequest {
  planId: string;
  returnUrl?: string;
}

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export interface Invoice {
  id: string;
  chargebeeInvoiceId: string;
  invoiceNumber?: string | null;
  status: string;
  currency: string;
  amountCents: number;
  pdfUrl?: string | null;
  paidAt?: string | null;
  issuedAt: string;
}

export const billingService = {
  getEntitlement: async (): Promise<Entitlement> => {
    const res = await apiClient.get<Entitlement>(BILLING.ENTITLEMENT);

    return res.data;
  },

  listInvoices: async (): Promise<Invoice[]> => {
    const res = await apiClient.get<{ items: Invoice[] }>(BILLING.INVOICES);

    return res.data.items;
  },

  startCheckout: async (body: CheckoutRequest): Promise<CheckoutResponse> => {
    const res = await apiClient.post<CheckoutResponse>(BILLING.CHECKOUT, body);

    return res.data;
  },

  openPortal: async (): Promise<PortalResponse> => {
    const res = await apiClient.post<PortalResponse>(BILLING.PORTAL);

    return res.data;
  },

  cancelSubscription: async (params?: {
    endOfTerm?: boolean;
    reason?: string;
  }): Promise<void> => {
    await apiClient.post(BILLING.CANCEL, params ?? {});
  },
};
