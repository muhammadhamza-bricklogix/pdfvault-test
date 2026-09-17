import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Document } from "@/lib/shared/types/documents.types";

import { W9_LIBRARY_FILENAME } from "@/components/sections/forms/W9FinalizeIntercept";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";

function safeDownloadFilename(name: string): string {
  const trimmed = name.trim();

  return trimmed || "document.pdf";
}

/**
 * The canonical W-9 library filename never gets renamed — the actions
 * menu hides Rename for it (`document-actions-menu.tsx`) — so a
 * filename compare is a safe way to spot server-finalized W-9 saves
 * without paying the per-doc GET that a full `editorState` inspection
 * would need (the list endpoint trims `editorState` on many rows).
 */
function isW9SystemDoc(doc: Pick<Document, "filename">): boolean {
  return doc.filename.toLowerCase() === W9_LIBRARY_FILENAME.toLowerCase();
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
 * Downloads a document from the dashboard.
 *
 * WHY the router route exists (P0 fix 2026-09-17):
 *
 * The Save path deliberately keeps shapes / drawings / highlights /
 * annotations / signatures / page numbers / watermark / bg image OUT of
 * the cloud-saved PDF bytes — `stripBakedOverlaysForSave` filters them
 * so only modified `editModeText` is baked (see `save-utils.ts` +
 * pdf-editor-architecture skill log 2026-09-10 (b)). Those overlays
 * live overlay-only in the doc's `editorState` JSON and are re-rendered
 * as Fabric objects on editor reload. Streaming the cloud URL alone
 * ships a PDF missing every overlay the user added — the reported bug.
 *
 * Fix: after the paywall gate, route non-W-9 downloads to
 * `/pdf-composer?id=<id>&export=pdf`. The auth-chain auto-launch
 * (hydrator Step 4 + `useExportEditor` items #1–4) loads the doc,
 * hydrates `editorState`, and dispatches `editor:export` — which runs
 * `buildEditedPdfBytes({ bakeOverlays: true })` and downloads the fully
 * baked bytes. The pre-navigate paywall unlocks the entitlement cache
 * the editor's own PDF gate reads, so the user sees the paywall once
 * (or not at all if entitled). W-9 library saves are server-finalized
 * on save, so their cloud PDF IS the definitive file — stream those
 * directly to skip a needless editor round-trip.
 *
 * `router` is optional: bulk download loops through docs sequentially,
 * and only the last `router.push` would win. Bulk callers therefore
 * omit the router and fall back to the stream path. Single-doc
 * downloads (row action, Recents) pass the router and get the edited
 * bake. Bulk of edited PDFs remains a known gap tracked separately.
 *
 * Gates on entitlement for EVERY document — see CLAUDE.md auth-chain
 * item #17 (QA 2026-09-14, hardened 2026-09-15). Cancelled paywalls
 * return silently so callers can distinguish success (no throw) from a
 * dismissed gate.
 */
export async function triggerDocumentDownload(
  doc: Document,
  router?: AppRouterInstance,
): Promise<void> {
  try {
    const outcome = await requestPaywall(undefined, { hidePreview: true });

    if (outcome !== "success") return;
  } catch (err) {
    if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
      return;
    }
    throw err;
  }

  if (!router || isW9SystemDoc(doc)) {
    await streamCloudDocument(doc);

    return;
  }

  const query = new URLSearchParams({ id: doc.id, export: "pdf" });

  router.push(`${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`);
}
