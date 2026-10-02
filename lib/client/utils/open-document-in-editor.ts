import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Document } from "@/lib/shared/types/documents.types";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * True when the document's `editorState` carries a `w9` marker, meaning it
 * was saved from `/w-9-form` and the raw form values are stashed on the doc so
 * we can round-trip the user back into the W-9 editor with their entries
 * pre-filled. Detection is best-effort: malformed JSON, older saves without
 * the marker, and manual uploads all fall through to the regular pdf-composer
 * open path.
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

function isNecDocument(doc: Pick<Document, "editorState">): boolean {
  const raw = doc.editorState;

  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { nec?: unknown };

    return typeof parsed === "object" && parsed !== null && Boolean(parsed.nec);
  } catch {
    return false;
  }
}

/**
 * Opens a saved document in the editor.
 *
 * Converted PDFs (X-to-PDF via the pending-conversion flow, i.e.
 * `originalContentType != null`) open in composer like native PDFs. The
 * dashboard paywall is reserved for Download actions so users can review and
 * edit converted files before deciding to download.
 *
 * On success routes to `/pdf-composer?id=<docId>`, or when the doc is a saved
 * W-9, to `/w-9-form?resumeDocId=<docId>` so the user re-enters the
 * yellow-overlay editor with their previous values restored.
 *
 * Extra `queryParams` are forwarded verbatim, for example `{ tool: "split" }`
 * for the doc-picker-modal tool-launch flow. Ignored on the W-9 path since
 * the W-9 editor has its own dedicated UI.
 */
export async function openDocumentInEditor(
  router: AppRouterInstance,
  doc: Document,
  queryParams?: Record<string, string | undefined>,
): Promise<void> {
  // Detect W-9 for the dashboard-to-W-9-editor round trip. The list endpoint
  // trims payload size and often omits `editorState`, so a list row's
  // `editorState` may be `undefined` on a saved W-9 that absolutely has one.
  // Fall back to a per-doc GET before deciding. Slight extra latency at click
  // time is worth it: the alternative is silently routing every saved W-9 into
  // the generic composer.
  let w9 = isW9Document(doc);
  let nec = isNecDocument(doc);

  if (!w9 && !nec && doc.editorState == null) {
    try {
      const full = await documentsService.getDocument(doc.id);

      w9 = isW9Document(full);
      nec = isNecDocument(full);
    } catch {
      // Non-fatal: fall through to the composer route.
    }
  }

  if (w9) {
    const query = new URLSearchParams({ resumeDocId: doc.id });

    router.push(`${ROUTES.FORMS.W9_SHORT}?${query.toString()}`);

    return;
  }

  if (nec) {
    const query = new URLSearchParams({ resumeDocId: doc.id });

    router.push(`${ROUTES.FORMS.NEC_1099_EDIT}?${query.toString()}`);

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
