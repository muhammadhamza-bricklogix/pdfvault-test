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

// Google Ads click IDs land in cookies from landing URLs; bots (Bing,
// Microsoft crawlers) sometimes visit with `?gclid=<junk>` or a
// pathologically long / non-URL-safe string. Reject the cookie value
// before forwarding so a bot-poisoned session can't 400 the backend on
// checkout-intent (Ads uses alphanumeric + `._~%-` in practice; anything
// else is either garbage or a bot fingerprint).
const CLICK_ID_MAX_LENGTH = 200;
const CLICK_ID_ALLOWED_CHARS = /^[A-Za-z0-9._~%-]+$/;

function sanitizeClickId(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();

  if (trimmed.length === 0) return undefined;
  if (trimmed.length > CLICK_ID_MAX_LENGTH) return undefined;
  if (!CLICK_ID_ALLOWED_CHARS.test(trimmed)) return undefined;

  return trimmed;
}

// Filename cleanup: the paywall accepts a File.name from the browser
// (headless bots occasionally supply an empty string or an oversized
// blob-URL surrogate). NestJS DTO validation on the backend may enforce
// `@IsNotEmpty` + `@Length(1, N)` when the field is present, so an
// empty string is worse than `undefined`. Cap at 200 chars — well
// under any realistic filename length + Sentry-friendly.
const FILENAME_MAX_LENGTH = 200;

function sanitizeFileName(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();

  if (trimmed.length === 0) return undefined;

  return trimmed.slice(0, FILENAME_MAX_LENGTH);
}

async function createCheckoutIntent(
  input: CheckoutIntentRequest,
): Promise<CheckoutIntent> {
  // Enrich with whichever Google Ads click IDs were captured on the
  // landing URL (see `GoogleAdsClickBoot`). Explicit-input fields still
  // win — callers can override in tests. Undefined + sanitised-away
  // fields are omitted so the JSON payload stays clean when the user
  // didn't arrive via an ad, or the stored ID looks like garbage.
  const stored = getStoredGoogleClickIds();
  const gclid = sanitizeClickId(stored.gclid);
  const gbraid = sanitizeClickId(stored.gbraid);
  const wbraid = sanitizeClickId(stored.wbraid);
  const clickTimestamp =
    (gclid || gbraid || wbraid) && stored.clickTimestamp
      ? stored.clickTimestamp
      : undefined;
  const cleanFileName = sanitizeFileName(input.fileName);
  const enriched: CheckoutIntentRequest = {
    ...(gclid ? { gclid } : {}),
    ...(gbraid ? { gbraid } : {}),
    ...(wbraid ? { wbraid } : {}),
    ...(clickTimestamp ? { clickTimestamp } : {}),
    ...input,
    // Spread cleaned filename AFTER `...input` so a garbage-empty
    // fileName from the caller can't survive the sanitisation.
    ...(cleanFileName ? { fileName: cleanFileName } : { fileName: undefined }),
  };

  // Drop any explicit `undefined` — JSON.stringify would omit it, but
  // the extra tidying keeps logs + retries readable.
  if (enriched.fileName === undefined) delete enriched.fileName;

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
