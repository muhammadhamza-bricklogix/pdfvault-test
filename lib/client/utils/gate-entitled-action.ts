import type { Document } from "@/lib/shared/types/documents.types";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { isConvertedDocument } from "@/lib/shared/types/documents.types";

/**
 * DOWNLOAD-time gate. Returns true if the caller is allowed to proceed.
 * Two escapes:
 *   1. The document isn't gated at all (native PDF upload —
 *      `originalContentType == null`). Free to Download.
 *   2. The user is entitled OR completed the paywall. Otherwise false
 *      (paywall cancelled or network read failed).
 *
 * QA 2026-09-08: OPEN is no longer gated — `openDocumentInEditor` bypasses
 * this helper entirely. Every document (native or converted) opens freely.
 * The paywall belongs at Download only. Callers to this helper should be
 * download-related (see `trigger-document-download.ts`); do NOT re-add it
 * to `openDocumentInEditor` or the "unable to review converted output"
 * regression comes back.
 */
export async function gateEntitledAction(
  doc?: Pick<Document, "originalContentType"> | null,
): Promise<boolean> {
  if (doc !== undefined && !isConvertedDocument(doc)) return true;

  const entitled = await ensureFreshEntitlement();

  if (entitled) return true;

  try {
    const outcome = await requestPaywall(undefined, { hidePreview: true });

    return outcome === "success";
  } catch (err) {
    if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
      return false;
    }
    throw err;
  }
}
