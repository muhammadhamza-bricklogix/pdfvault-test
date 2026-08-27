import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Document } from "@/lib/shared/types/documents.types";

import { ROUTES } from "@/lib/shared/constants/routes";

import { gateEntitledAction } from "./gate-entitled-action";

/**
 * True when the document's `editorState` carries a `w9` marker — i.e. it
 * was saved from `/w-9-form` and the raw form values are stashed on the
 * doc so we can round-trip the user back into the W-9 editor with their
 * entries pre-filled. Detection is best-effort: malformed JSON, older
 * saves without the marker, and manual uploads all fall through to the
 * regular pdf-composer open path.
 */
function isW9Document(doc: Pick<Document, "editorState">): boolean {
  const raw = doc.editorState;

  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { w9?: unknown };

    return typeof parsed === "object" && parsed !== null && Boolean(parsed.w9);
  } catch {
    return false;
  }
}

/**
 * Opens a saved document in the editor. Gates on entitlement ONLY when
 * the document is a converted PDF (`originalContentType != null`) —
 * native PDF uploads are free to open. On success routes to
 * `/pdf-composer?id=<docId>`, or — when the doc is a saved W-9 — to
 * `/w-9-form?resumeDocId=<docId>` so the user re-enters the yellow-
 * overlay editor with their previous values restored.
 *
 * Extra `queryParams` are forwarded verbatim — e.g. `{ tool: "split" }`
 * for the doc-picker-modal tool-launch flow. Ignored on the W-9 path
 * since the W-9 editor has its own dedicated UI.
 */
export async function openDocumentInEditor(
  router: AppRouterInstance,
  doc: Document,
  queryParams?: Record<string, string | undefined>,
): Promise<void> {
  const allowed = await gateEntitledAction(doc);

  if (!allowed) return;

  if (isW9Document(doc)) {
    const query = new URLSearchParams({ resumeDocId: doc.id });

    router.push(`${ROUTES.FORMS.W9_SHORT}?${query.toString()}`);

    return;
  }

  const query = new URLSearchParams({ id: doc.id });

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) query.set(key, value);
    }
  }

  router.push(`${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`);
}
