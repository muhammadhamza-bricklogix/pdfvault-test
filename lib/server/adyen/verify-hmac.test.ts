/// <reference types="bun" />
import type { AdyenNotificationRequestItem } from "./types";

import { describe, expect, test } from "bun:test";

import {
  buildSigningPayload,
  computeHmacSignature,
  verifyHmacSignature,
} from "./verify-hmac";

/**
 * Adyen publishes a canonical HMAC test vector so integrators can prove their
 * signer matches. Values below are from Adyen's docs — if this test fails,
 * our escaping / field-order / key-decoding drifted from Adyen's spec.
 *
 * https://docs.adyen.com/development-resources/webhooks/verify-hmac-signatures/#test-the-hmac-verification
 */
const ADYEN_DOC_KEY_HEX =
  "44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056";

const ADYEN_DOC_ITEM: AdyenNotificationRequestItem = {
  pspReference: "7914073381342284",
  originalReference: "",
  merchantAccountCode: "TestMerchant",
  merchantReference: "TestPayment-1407325143704",
  amount: { value: 1130, currency: "EUR" },
  eventCode: "AUTHORISATION",
  success: "true",
  eventDate: "2019-01-01T01:00:00.000+01:00",
};

const ADYEN_DOC_EXPECTED_SIG = "coqCmt/IZ4E3CzPvMY8zTjQVL5hYJUiBRg8UU+iCWo0=";

const withSig = (
  item: AdyenNotificationRequestItem,
  sig: string,
): AdyenNotificationRequestItem => ({
  ...item,
  additionalData: { hmacSignature: sig },
});

describe("adyen buildSigningPayload", () => {
  test("joins the eight signed fields with ':' in Adyen's documented order", () => {
    expect(buildSigningPayload(ADYEN_DOC_ITEM)).toBe(
      "7914073381342284::TestMerchant:TestPayment-1407325143704:1130:EUR:AUTHORISATION:true",
    );
  });

  test("escapes ':' and '\\' inside field values", () => {
    const item: AdyenNotificationRequestItem = {
      ...ADYEN_DOC_ITEM,
      merchantReference: "order:42\\alpha",
    };

    expect(buildSigningPayload(item)).toBe(
      "7914073381342284::TestMerchant:order\\:42\\\\alpha:1130:EUR:AUTHORISATION:true",
    );
  });
});

describe("adyen computeHmacSignature", () => {
  test("matches Adyen's published test vector", () => {
    expect(computeHmacSignature(ADYEN_DOC_ITEM, ADYEN_DOC_KEY_HEX)).toBe(
      ADYEN_DOC_EXPECTED_SIG,
    );
  });

  test("throws when the HMAC key is not valid hex bytes", () => {
    expect(() => computeHmacSignature(ADYEN_DOC_ITEM, "")).toThrow();
  });
});

describe("adyen verifyHmacSignature", () => {
  test("accepts a payload signed with the correct key", () => {
    const signed = withSig(ADYEN_DOC_ITEM, ADYEN_DOC_EXPECTED_SIG);

    expect(verifyHmacSignature(signed, ADYEN_DOC_KEY_HEX)).toBe(true);
  });

  test("rejects a payload whose amount was tampered with after signing", () => {
    const tampered: AdyenNotificationRequestItem = {
      ...withSig(ADYEN_DOC_ITEM, ADYEN_DOC_EXPECTED_SIG),
      amount: { value: 999999, currency: "EUR" },
    };

    expect(verifyHmacSignature(tampered, ADYEN_DOC_KEY_HEX)).toBe(false);
  });

  test("rejects a payload with a forged signature of the right shape", () => {
    // Base64 of 32 random bytes — same length as a real HMAC-SHA256 output,
    // guaranteed not to match. Guards against a naive length-only check.
    const forged = Buffer.alloc(32, 0xab).toString("base64");
    const signed = withSig(ADYEN_DOC_ITEM, forged);

    expect(verifyHmacSignature(signed, ADYEN_DOC_KEY_HEX)).toBe(false);
  });

  test("rejects a payload missing hmacSignature entirely", () => {
    expect(verifyHmacSignature(ADYEN_DOC_ITEM, ADYEN_DOC_KEY_HEX)).toBe(false);
  });

  test("rejects a payload signed with a different key", () => {
    const wrongKey =
      "00000000000000000000000000000000000000000000000000000000000000FF";
    const signed = withSig(ADYEN_DOC_ITEM, ADYEN_DOC_EXPECTED_SIG);

    expect(verifyHmacSignature(signed, wrongKey)).toBe(false);
  });
});
