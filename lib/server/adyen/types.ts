/**
 * Adyen webhook payload shapes.
 *
 * Reference: https://docs.adyen.com/development-resources/webhooks/understand-notifications/
 */

export type AdyenEventCode =
  | "AUTHORISATION"
  | "CAPTURE"
  | "CANCELLATION"
  | "CANCEL_OR_REFUND"
  | (string & {});

export interface AdyenAmount {
  value: number;
  currency: string;
}

export interface AdyenAdditionalData {
  hmacSignature?: string;
  [key: string]: string | undefined;
}

export interface AdyenNotificationRequestItem {
  additionalData?: AdyenAdditionalData;
  amount: AdyenAmount;
  eventCode: AdyenEventCode;
  eventDate: string;
  merchantAccountCode: string;
  merchantReference: string;
  originalReference?: string;
  paymentMethod?: string;
  pspReference: string;
  reason?: string;
  /** Adyen sends "true" / "false" as strings. */
  success: "true" | "false";
}

export interface AdyenNotificationEnvelope {
  live: "true" | "false";
  notificationItems: Array<{
    NotificationRequestItem: AdyenNotificationRequestItem;
  }>;
}
