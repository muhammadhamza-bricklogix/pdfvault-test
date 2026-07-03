import type { AdyenNotificationRequestItem } from "./types";

import { logger } from "@/lib/shared/utils/logger";

/**
 * Event handlers for the Adyen notifications we care about in the
 * trial → subscription billing flow.
 *
 * These are log-only stubs today. Once Chargebee is wired up, the subscription
 * side of the flow will be driven by Chargebee webhooks; Adyen webhooks are
 * mainly here for direct-charge visibility and chargeback surfacing. Business
 * logic (entitlement flips, dispute alerts, etc.) will land in these handlers.
 */

type Handler = (item: AdyenNotificationRequestItem) => Promise<void> | void;

const onAuthorisation: Handler = (item) => {
  logger.info("[adyen] AUTHORISATION", {
    pspReference: item.pspReference,
    merchantReference: item.merchantReference,
    success: item.success,
    amount: item.amount,
    reason: item.reason,
  });
};

const onCapture: Handler = (item) => {
  logger.info("[adyen] CAPTURE", {
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    merchantReference: item.merchantReference,
    success: item.success,
    amount: item.amount,
  });
};

const onCancellation: Handler = (item) => {
  logger.info("[adyen] CANCELLATION", {
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    merchantReference: item.merchantReference,
    success: item.success,
  });
};

const onCancelOrRefund: Handler = (item) => {
  logger.info("[adyen] CANCEL_OR_REFUND", {
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    merchantReference: item.merchantReference,
    success: item.success,
    amount: item.amount,
    reason: item.reason,
  });
};

const HANDLERS: Record<string, Handler> = {
  AUTHORISATION: onAuthorisation,
  CAPTURE: onCapture,
  CANCELLATION: onCancellation,
  CANCEL_OR_REFUND: onCancelOrRefund,
};

export const dispatchAdyenEvent = async (
  item: AdyenNotificationRequestItem,
): Promise<void> => {
  const handler = HANDLERS[item.eventCode];

  if (!handler) {
    logger.info("[adyen] unhandled event", {
      eventCode: item.eventCode,
      pspReference: item.pspReference,
      merchantReference: item.merchantReference,
    });

    return;
  }

  try {
    await handler(item);
  } catch (error) {
    // Never throw out of a webhook handler — Adyen would retry indefinitely.
    logger.error("[adyen] handler failed", {
      eventCode: item.eventCode,
      pspReference: item.pspReference,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
