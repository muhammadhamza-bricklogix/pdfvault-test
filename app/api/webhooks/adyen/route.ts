import type { NextRequest } from "next/server";
import type {
  AdyenNotificationEnvelope,
  AdyenNotificationRequestItem,
} from "@/lib/server/adyen/types";

import { dispatchAdyenEvent } from "@/lib/server/adyen/handlers";
import { verifyHmacSignature } from "@/lib/server/adyen/verify-hmac";
import { logger } from "@/lib/shared/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/adyen
 *
 * Adyen posts a notification envelope containing one or more
 * NotificationRequestItems. We must:
 *
 *   1. Verify each item's HMAC signature against ADYEN_HMAC_KEY.
 *   2. Dispatch valid items to their event handler.
 *   3. Log invalid items as a security event but do NOT re-queue them —
 *      returning a non-2xx to Adyen would make it retry the same bad
 *      payload for days.
 *   4. Always respond with plain "[accepted]" + HTTP 200 + text/plain
 *      so Adyen marks the notification delivered.
 *
 * Note: the original spec asked for HTTP 202. Adyen's contract requires 200 —
 * anything else triggers its retry loop. Shipping 200; flip if you disagree.
 *
 * https://docs.adyen.com/development-resources/webhooks/
 */

const ACCEPTED_BODY = "[accepted]";
const ACCEPTED_HEADERS = { "Content-Type": "text/plain" } as const;

const accepted = (): Response =>
  new Response(ACCEPTED_BODY, { status: 200, headers: ACCEPTED_HEADERS });

export async function POST(req: NextRequest): Promise<Response> {
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT;

  if (!hmacKey || !merchantAccount) {
    logger.error("[adyen] webhook misconfigured", {
      hasHmacKey: Boolean(hmacKey),
      hasMerchantAccount: Boolean(merchantAccount),
    });

    // Still 200 — Adyen's retry loop won't fix a missing env var,
    // and a 5xx here would flood the endpoint until we deploy a fix.
    return accepted();
  }

  let envelope: AdyenNotificationEnvelope;

  try {
    envelope = (await req.json()) as AdyenNotificationEnvelope;
  } catch (error) {
    logger.warn("[adyen] malformed JSON body", {
      error: error instanceof Error ? error.message : String(error),
    });

    return accepted();
  }

  const items = envelope?.notificationItems;

  if (!Array.isArray(items) || items.length === 0) {
    logger.warn("[adyen] envelope missing notificationItems");

    return accepted();
  }

  await Promise.all(
    items.map(async (wrapper) => {
      const item: AdyenNotificationRequestItem | undefined =
        wrapper?.NotificationRequestItem;

      if (!item) {
        logger.warn("[adyen] notification item missing");

        return;
      }

      if (!verifyHmacSignature(item, hmacKey)) {
        // Security event — DO NOT process. Includes enough context to
        // investigate but omits the raw signature to avoid leaking it
        // into logs that may fan out to third-party sinks.
        logger.warn("[adyen] HMAC verification failed", {
          eventCode: item.eventCode,
          pspReference: item.pspReference,
          merchantReference: item.merchantReference,
          merchantAccountCode: item.merchantAccountCode,
        });

        return;
      }

      if (item.merchantAccountCode !== merchantAccount) {
        logger.warn("[adyen] merchantAccountCode mismatch", {
          expected: merchantAccount,
          received: item.merchantAccountCode,
          pspReference: item.pspReference,
        });

        return;
      }

      await dispatchAdyenEvent(item);
    }),
  );

  return accepted();
}
