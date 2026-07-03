import type { AdyenNotificationRequestItem } from "./types";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Adyen's HMAC-SHA256 signature on a NotificationRequestItem.
 *
 * Adyen signs eight fields, joined with ':', where each field has backslashes
 * escaped as '\\' and colons escaped as '\:'. The HMAC key is provided in the
 * Customer Area as a hex string and must be decoded to bytes before signing.
 *
 * https://docs.adyen.com/development-resources/webhooks/verify-hmac-signatures/
 */

const SIGNED_FIELDS = [
  "pspReference",
  "originalReference",
  "merchantAccountCode",
  "merchantReference",
  "amountValue",
  "amountCurrency",
  "eventCode",
  "success",
] as const;

const escapeField = (raw: string | number | undefined): string => {
  const value = raw === undefined || raw === null ? "" : String(raw);

  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
};

export const buildSigningPayload = (
  item: AdyenNotificationRequestItem,
): string => {
  const map: Record<
    (typeof SIGNED_FIELDS)[number],
    string | number | undefined
  > = {
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    merchantAccountCode: item.merchantAccountCode,
    merchantReference: item.merchantReference,
    amountValue: item.amount?.value,
    amountCurrency: item.amount?.currency,
    eventCode: item.eventCode,
    success: item.success,
  };

  return SIGNED_FIELDS.map((field) => escapeField(map[field])).join(":");
};

export const computeHmacSignature = (
  item: AdyenNotificationRequestItem,
  hmacKeyHex: string,
): string => {
  const key = new Uint8Array(Buffer.from(hmacKeyHex, "hex"));

  if (key.length === 0) {
    throw new Error(
      "adyen: HMAC key decoded to empty buffer — check ADYEN_HMAC_KEY",
    );
  }

  const payload = buildSigningPayload(item);

  return createHmac("sha256", key).update(payload, "utf8").digest("base64");
};

/**
 * Constant-time compare the signature Adyen sent against the one we compute
 * from the same fields. Returns false on any structural issue rather than
 * throwing, so callers can uniformly treat "invalid" as one code path.
 */
export const verifyHmacSignature = (
  item: AdyenNotificationRequestItem,
  hmacKeyHex: string,
): boolean => {
  const provided = item.additionalData?.hmacSignature;

  if (!provided) {
    return false;
  }

  let expected: string;

  try {
    expected = computeHmacSignature(item, hmacKeyHex);
  } catch {
    return false;
  }

  const a = new Uint8Array(Buffer.from(provided, "base64"));
  const b = new Uint8Array(Buffer.from(expected, "base64"));

  if (a.length !== b.length || a.length === 0) {
    return false;
  }

  return timingSafeEqual(a, b);
};
