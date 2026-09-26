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

async function streamCloudDocument(doc: Document): Promise<void> {
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

/**
 * Downloads a document from the dashboard. Paywall gates entitlement
 * for every doc (CLAUDE.md auth-chain item #17); cancelled paywall
 * returns silently.
 *
 * TRADEOFF (2026-09-21, per user request): streams the cloud PDF
 * directly instead of routing through the editor. The Save path strips
 * overlay-only edits (shapes / drawings / highlights / annotations /
 * signatures / page numbers / watermark / bg image) from cloud bytes
 * via `stripBakedOverlaysForSave` — those overlays live in
 * `editorState` and only bake at export time. Downloads therefore ship
 * baked `editModeText` mods but MISS every other overlay. The prior
 * router-push flow (P0 fix 2026-09-17) re-hydrated `editorState` in
 * the editor and auto-exported to bake overlays; user chose direct
 * download over the editor round-trip.
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

  await streamCloudDocument(doc);
}
