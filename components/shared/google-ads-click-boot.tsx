"use client";

import { useEffect } from "react";

import { captureGoogleClickIds } from "@/lib/client/analytics/google-click-id";

/**
 * Mounts once at the app root and captures Google Ads click identifiers
 * (`gclid` / `gbraid` / `wbraid`) from the landing URL into 1st-party
 * cookies. The backend later reads these off the checkout-intent request
 * and forwards them to Google Ads' Offline Conversion Import API when the
 * day-7 first payment, day-45 rebill, and day-60 rebill events fire from
 * Solidgate webhooks.
 *
 * We run this in an effect (not at module scope) so it stays inside the
 * client-only render pass — cookie writes during SSR are a no-op but the
 * URLSearchParams read would still throw without `window`.
 */
export function GoogleAdsClickBoot() {
  useEffect(() => {
    captureGoogleClickIds();
  }, []);

  return null;
}
