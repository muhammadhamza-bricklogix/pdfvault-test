import type { Document } from "@/lib/shared/types/documents.types";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { isConvertedDocument } from "@/lib/shared/types/documents.types";

/**
 * Entitlement gate for paid saved-document actions. Opening converted PDFs in
 * composer is intentionally free; callers should use this helper only for
 * actions that actually deliver the converted output, such as dashboard
 * Download.
 *
 * Native PDF uploads (`originalContentType == null`) short-circuit as free.
 * Converted PDFs require an active entitlement or a completed paywall.
 */
export async function gateEntitledAction(
  doc?: Pick<Document, "originalContentType"> | null,
): Promise<boolean> {
  if (doc !== undefined && !isConvertedDocument(doc)) return true;

  const entitled = await ensureFreshEntitlement();

  if (entitled) return true;

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
