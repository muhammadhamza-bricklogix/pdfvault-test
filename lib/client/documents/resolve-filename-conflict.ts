import {
  findDuplicateByFilename,
  nextAvailableFilename,
} from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import {
  requestDuplicatePrompt,
  waitForDuplicatePrompt,
} from "@/lib/client/hooks/documents/duplicate-prompt-bus";
import { logger } from "@/lib/shared/utils/logger";

export type FilenameConflictResolution =
  /** Upsert into this row. The filename is the row's own — see note below. */
  | { kind: "replace"; documentId: string; filename: string }
  /** Create a new row under this name. */
  | { kind: "proceed"; filename: string }
  /** User backed out; do not save. */
  | { kind: "cancel" };

/**
 * Decide what a save should do about its filename, prompting the user only
 * when there is a real collision.
 *
 * The form editors upload directly rather than through
 * `persistEditorDocument`, so this is the shared gate both routes call.
 *
 *   - already own a row  -> replace it, no prompt (same document)
 *   - name is free       -> proceed under that name
 *   - name is taken      -> prompt: Replace / Save as a new file / Cancel
 *   - lookup failed      -> proceed, matching the existing fail-open
 *                           behaviour: a flaky list call must not block a save
 *
 * On replace the resolution carries the EXISTING row's filename, because the
 * backend's `updateFile` writes the uploaded file's name onto the row — so
 * uploading under a different name would silently rename (or re-case) the
 * document the user chose to replace.
 */
export async function resolveFilenameConflict({
  filename,
  getOwnedDocumentId,
}: {
  filename: string;
  /**
   * Read lazily, AFTER any in-flight prompt settles — by then an autosave
   * may have created the row, and this save should just update it.
   */
  getOwnedDocumentId: () => string | null | undefined;
}): Promise<FilenameConflictResolution> {
  // Another save is already asking the user about a name. Wait for that
  // decision instead of stacking a second dialog or failing this save —
  // failing it reads as "cancelled" and strands a pending navigation.
  await waitForDuplicatePrompt();

  const currentDocumentId = getOwnedDocumentId();

  if (currentDocumentId) {
    return { kind: "replace", documentId: currentDocumentId, filename };
  }

  let existing = null;

  try {
    existing = await findDuplicateByFilename(filename);
  } catch (err) {
    logger.captureError(err, "save.duplicate_check");

    return { kind: "proceed", filename };
  }

  if (!existing) return { kind: "proceed", filename };

  let suggestion: string | undefined;

  try {
    suggestion = await nextAvailableFilename(filename);
  } catch (err) {
    logger.captureError(err, "save.duplicate_suggestion");
  }

  const outcome = await requestDuplicatePrompt({
    existing,
    filename: existing.filename,
    ...(suggestion ? { suggestion } : {}),
  });

  if (outcome.kind === "cancel") return { kind: "cancel" };

  if (outcome.kind === "rename") {
    return { kind: "proceed", filename: outcome.filename };
  }

  return {
    kind: "replace",
    documentId: existing.id,
    filename: existing.filename,
  };
}
