"use client";

import { useEffect } from "react";

import { captureAcquisition } from "@/lib/client/analytics/acquisition-tracker";

/**
 * Mounts once at the application root and records the visitor's initial
 * landing source (Google Ads, Bing Ads, Organic Search, Referral, Direct).
 *
 * Runs inside an effect to ensure client-only execution.
 */
export function AcquisitionBoot() {
  useEffect(() => {
    captureAcquisition();
  }, []);

  return null;
}
