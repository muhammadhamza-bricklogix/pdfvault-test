import type { Document } from "@/lib/shared/types/documents.types";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { documentsService } from "@/lib/shared/api/services/documents.service";

function safeDownloadFilename(name: string): string {
  const trimmed = name.trim();

  return trimmed || "document.pdf";
}

/**
 * Fetches a fresh presigned URL and saves the file locally.
 * Uses a blob + object URL so `download` works cross-origin (opening the URL in a new tab often ignores `download` and previews the PDF instead).
 *
 * Gates on entitlement for EVERY document — native uploads and converted
 * PDFs alike require an active subscription (QA 2026-09-14 revised item
 * #17). Non-entitled users see the paywall first and only proceed after
 * payment succeeds. Returns silently if the paywall is cancelled so
 * callers can distinguish success (no throw) from a dismissed gate.
 */
export async function triggerDocumentDownload(doc: Document): Promise<void> {
  const entitled = await ensureFreshEntitlement();

  if (!entitled) {
    try {
      const outcome = await requestPaywall(undefined, { hidePreview: true });

      if (outcome !== "success") return;
    } catch (err) {
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
      throw err;
    }
  }

  const { url } = await documentsService.getDocument(doc.id);
  const filename = safeDownloadFilename(doc.filename);
  const res = await fetch(url, {
    credentials: "omit",
    method: "GET",
    mode: "cors",
  });

  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");

  anchor.download = filename;
  anchor.href = objectUrl;
  anchor.rel = "noopener";
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 2000);
}
