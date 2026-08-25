import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Document } from "@/lib/shared/types/documents.types";

import { ROUTES } from "@/lib/shared/constants/routes";

import { gateEntitledAction } from "./gate-entitled-action";

/**
 * Opens a saved document in the editor. Gates on entitlement ONLY when
 * the document is a converted PDF (`originalContentType != null`) —
 * native PDF uploads are free to open. On success routes to
 * `/pdf-composer?id=<docId>`.
 *
 * Extra `queryParams` are forwarded verbatim — e.g. `{ tool: "split" }`
 * for the doc-picker-modal tool-launch flow.
 */
export async function openDocumentInEditor(
  router: AppRouterInstance,
  doc: Document,
  queryParams?: Record<string, string | undefined>,
): Promise<void> {
  const allowed = await gateEntitledAction(doc);

  if (!allowed) return;

  const query = new URLSearchParams({ id: doc.id });

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) query.set(key, value);
    }
  }

  router.push(`${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`);
}
