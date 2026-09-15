import type { Document } from "@/lib/shared/types/documents.types";

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
 * #17, hardened 2026-09-15). Every Download click defers to
 * `requestPaywall`, which reads the LIVE `useSubscriptionQuery` cache
 * inside the bus handler (`use-paywall.ts`) — entitled users are
 * short-circuited to `"success"` there with no visible modal flash;
 * non-entitled users see the paywall. Going through the bus (instead
 * of pre-checking via the module-level `entitledSnapshot`) closes the
 * race where the snapshot's mirror `useEffect` hasn't landed yet after
 * a cancel/downgrade — the bus reads React state, so it's always as
 * fresh as the last query resolution. Cancelled paywalls return
 * silently so callers can distinguish success (no throw) from a
 * dismissed gate.
 */
export async function triggerDocumentDownload(doc: Document): Promise<void> {
  try {
    const outcome = await requestPaywall(undefined, { hidePreview: true });

    if (outcome !== "success") return;
  } catch (err) {
    if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
      return;
    }
    throw err;
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
