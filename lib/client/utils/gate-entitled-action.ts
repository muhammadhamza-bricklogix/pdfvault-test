import type { Document } from "@/lib/shared/types/documents.types";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { isConvertedDocument } from "@/lib/shared/types/documents.types";

/**
 * Entitlement gate for actions on saved documents. Returns true if the
 * caller is allowed to proceed. Two escapes:
 *   1. The document isn't gated at all (native PDF upload —
 *      `originalContentType == null`). Free.
 *   2. The user is entitled OR completed the paywall. Otherwise false
 *      (paywall cancelled or network read failed).
 *
 * QA 2026-09-09 (partial restore of item #17): converted PDFs (X→PDF
 * via the pending-conversion flow) gate on Open + Download + Share.
 * Non-entitled users hit the paywall before any of those actions.
 * Native PDF uploads stay free across the board.
 */
export async function gateEntitledAction(
  doc?: Pick<Document, "originalContentType"> | null,
): Promise<boolean> {
  if (doc !== undefined && !isConvertedDocument(doc)) return true;

  const entitled = await ensureFreshEntitlement();

  if (entitled) return true;

  // QA 2026-09-09 — converted documents force the paywall open. Product
  // decision: signed-up-but-non-entitled users cannot dismiss and get
  // free access to the converted file. Native PDFs never reach this
  // branch (short-circuit above), so `mandatory` only ever applies when
  // the doc is truly converted-and-gated. Other callers (download,
  // share, ad-hoc button clicks) go through their own request paths
  // that don't force `mandatory` unless they choose to.
  const isMandatory = doc !== undefined && isConvertedDocument(doc);

  try {
    const outcome = await requestPaywall(undefined, {
      hidePreview: true,
      mandatory: isMandatory,
    });

    return outcome === "success";
  } catch (err) {
    if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
      return false;
    }
    throw err;
  }
}
