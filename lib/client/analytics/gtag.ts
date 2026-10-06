"use client";

import { setBingUserData, trackBingPurchase } from "./bing-uet";

export { setBingUserData, trackBingPurchase } from "./bing-uet";

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-K6PVB4B39T";

/**
 * Safely fire an event to Google Analytics (GA4) via gtag.js.
 */
export function trackEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const gtag = window.gtag;

  if (typeof gtag !== "function") {
    return;
  }

  try {
    gtag("event", name, params);
  } catch (err) {
    // Analytics should never break user-facing flows
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[GA4] Failed to emit event ${name}:`, err);
    }
  }
}

/**
 * 1. sign_up
 * Recommended event: triggered when user successfully creates an account.
 * Standardizes and hashes user parameters (email, phone) for Bing UET & GTM dataLayer.
 * @param method 'google' | 'email' | 'github' etc.
 * @param user Optional user data (email, phone) for enhanced conversion tracking.
 */
export function trackSignUp(
  method: string,
  user?: { email?: string | null; phone?: string | null },
): void {
  trackEvent("sign_up", { method });
  if (user) {
    void setBingUserData(user);
  }
}

/**
 * 2. add_payment_info
 * Ecommerce event: triggered when the user enters credit card or billing details.
 */
export function trackAddPaymentInfo(params: {
  currency: string;
  value: number;
  coupon?: string;
  user?: { email?: string | null; phone?: string | null };
}): void {
  trackEvent("add_payment_info", {
    currency: params.currency,
    value: params.value,
    coupon: params.coupon || undefined,
  });
  if (params.user) {
    void setBingUserData(params.user);
  }
}

/**
 * 3. trial_start
 * Custom event: triggered when the 7-day trial officially starts upon payment confirmation.
 * Simultaneously fires Bing UET purchase conversion with dynamic revenue_value and currency.
 *
 * `price` is today's charge (trial token, e.g. $0.99 / $1.99) — used for GA4's
 * `trial_start` event so the trial funnel reflects what the user was actually
 * billed. `bingRevenueValue` is the full subscription value (e.g. $25 / $39.99 /
 * $300) sent to Bing UET so Smart Bidding optimises against real customer value
 * instead of the trial token. Defaults to `price` for backwards compatibility.
 */
export function trackTrialStart(params: {
  plan_name: string;
  price: number;
  bingRevenueValue?: number;
  currency: string;
  orderId?: string;
  user?: { email?: string | null; phone?: string | null };
}): void {
  trackEvent("trial_start", {
    plan_name: params.plan_name,
    price: params.price,
    currency: params.currency,
    value: params.price,
  });

  // Mirror purchase conversion to Bing UET. Send the subscription's recurring
  // value, not the trial token — Smart Bidding needs real customer value.
  trackBingPurchase({
    revenue_value: params.bingRevenueValue ?? params.price,
    currency: params.currency,
    orderId: params.orderId,
  });

  if (params.user) {
    void setBingUserData(params.user);
  }
}

/**
 * purchase
 * Ecommerce event: triggered on order confirmation / subscription payment.
 * Fires both GA4 purchase event and Bing UET purchase conversion.
 */
export function trackPurchase(params: {
  transaction_id: string;
  value: number;
  currency: string;
  items?: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity?: number;
  }>;
  user?: { email?: string | null; phone?: string | null };
}): void {
  trackEvent("purchase", {
    transaction_id: params.transaction_id,
    value: params.value,
    currency: params.currency,
    items: params.items,
  });

  trackBingPurchase({
    revenue_value: params.value,
    currency: params.currency,
    orderId: params.transaction_id,
  });

  if (params.user) {
    void setBingUserData(params.user);
  }
}

/**
 * 4. tutorial_complete / activation
 * Triggered when the user performs the core "Aha!" action within the 7 days (e.g. downloads edited/converted PDF).
 * Gated per user in localStorage so repeat downloads by the same user do not inflate activation counts,
 * while allowing different users on the same shared browser to each activate independently.
 */
export function trackActivation(
  feature_name: string,
  userId?: string | null,
): void {
  if (typeof window !== "undefined") {
    try {
      const key = userId
        ? `pv_activation_fired_${userId}`
        : "pv_activation_fired_anon";

      if (localStorage.getItem(key)) {
        return;
      }
      localStorage.setItem(key, "true");
    } catch {
      // Ignore storage errors if localStorage is restricted
    }
  }

  // We send both Google's standard recommended event name (tutorial_complete)
  // and the custom event name (activation) so both cards/reports capture it once per user.
  trackEvent("tutorial_complete", { feature_name });
  trackEvent("activation", { feature_name });
}

/**
 * 5. subscription_cancel
 * Custom event: triggered when the user cancels during or immediately after trial.
 */
export function trackSubscriptionCancel(params?: {
  cancel_reason?: string;
}): void {
  trackEvent("subscription_cancel", {
    cancel_reason: params?.cancel_reason || "other",
  });
}

/**
 * Extract the current GA4 Client ID for session stitching with backend Measurement Protocol.
 * Tries gtag('get', ...) first, with cookie fallback.
 */
export function getGaClientId(): Promise<string | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  // Fallback helper to inspect _ga cookie directly
  const readCookieClientId = (): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/_ga=(?:GA\d+\.\d+\.)?(\d+\.\d+)/);

    return match ? match[1] : null;
  };

  const gtag = window.gtag;

  if (typeof gtag !== "function") {
    return Promise.resolve(readCookieClientId());
  }

  return new Promise((resolve) => {
    let resolved = false;

    try {
      gtag("get", GA_MEASUREMENT_ID, "client_id", (clientId: unknown) => {
        if (!resolved) {
          resolved = true;
          if (typeof clientId === "string" && clientId.length > 0) {
            resolve(clientId);
          } else {
            resolve(readCookieClientId());
          }
        }
      });
    } catch {
      if (!resolved) {
        resolved = true;
        resolve(readCookieClientId());
      }
    }

    // Safety timeout in case gtag('get') doesn't callback
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(readCookieClientId());
      }
    }, 500);
  });
}
