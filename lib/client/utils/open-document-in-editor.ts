import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { ROUTES } from "@/lib/shared/constants/routes";

import { gateEntitledAction } from "./gate-entitled-action";

/**
 * Opens a saved document in the editor after gating on entitlement.
 * Non-entitled users see the paywall first. On success (or if already
 * entitled) routes to `/pdf-composer?id=<docId>`.
 *
 * Extra `queryParams` are forwarded verbatim — e.g. `{ tool: "split" }`
 * for the doc-picker-modal tool-launch flow.
 */
export async function openDocumentInEditor(
  router: AppRouterInstance,
  documentId: string,
  queryParams?: Record<string, string | undefined>,
): Promise<void> {
  const allowed = await gateEntitledAction();

  if (!allowed) return;

  const query = new URLSearchParams({ id: documentId });

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) query.set(key, value);
    }
  }

  router.push(`${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`);
}
