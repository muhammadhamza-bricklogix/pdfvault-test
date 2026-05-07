import type { Document } from "@/lib/shared/types/documents.types";

/** Stable string id for selection Sets (API may send numeric ids in JSON). */
export function documentSelectionKey(doc: Pick<Document, "id">): string {
  return String(doc.id);
}
