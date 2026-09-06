import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { toast } from "@/lib/shared/utils/toast";

type SaveBeforeActionReason =
  | "error"
  | "no-changes"
  | "no-file"
  | "not-signed-in"
  | "not-loaded"
  | "cancelled-duplicate";

/**
 * Persists the live editor state before running a destructive action (Create
 * New, Manage Pages, etc.). Routes through the `editor:save-before-action`
 * window event so the save runs inside `useSaveEditor`, which holds the live
 * Fabric canvas ref — calling `persistEditorDocument` from a shell-level modal
 * directly would pass `null` and silently upload stale `fabricJsonByPage`.
 *
 * Returns `true` when the action should proceed:
 *   - no unsaved changes  → nothing to do, resolve true immediately
 *   - save succeeded      → resolve true, action proceeds
 *   - save failed         → resolve false, caller shows error (except for
 *     `not-signed-in`, where we route through the sign-in prompt modal instead
 *     — same pattern as export / paywall / upload per CLAUDE.md items 4, 5, 17.
 *     Without this, a signed-out user who drops a PDF and clicks Manage Pages
 *     gets a dead-end "Could not save" toast with no path forward).
 *
 * Shows a loading toast while the save is in flight.
 */
export async function saveBeforeAction(
  description = "Saving your edits…",
  force = false,
  skipWait = false,
): Promise<boolean> {
  if (!force && !usePdfEditorStore.getState().hasUnsavedChanges) return true;

  const loadingKey = toast.loading({
    title: "Saving…",
    description,
  });

  try {
    const { ok, reason } = await new Promise<{
      ok: boolean;
      reason?: SaveBeforeActionReason;
    }>((resolve) => {
      window.dispatchEvent(
        new CustomEvent("editor:save-before-action", {
          detail: { force, skipWait, onComplete: resolve },
        }),
      );
    });

    if (!ok) {
      if (reason === "not-signed-in") {
        const returnTo =
          typeof window === "undefined"
            ? "/"
            : `${window.location.pathname}${window.location.search}`;

        // Snapshot file + fabric edits + extractedPages so the hydrator
        // restores the full editor state on return. Without this the
        // full-page Clerk redirect wipes overlays and Manage Pages / etc.
        // reopens against the pre-edit source — the "first-time login
        // drops my edits" bug for save-before-action callers.
        await snapshotPendingEditorFile().catch(() => undefined);

        // AuthModal (2026-08-28 unify). Cards' finalize
        // `window.location.assign(returnTo)` (item #15) lands the user
        // back on the same route with the snapshotted file intact.
        dispatchAuthModal({
          mode: "login",
          redirectUrl: returnTo,
        });
      } else if (reason === "cancelled-duplicate") {
        // User picked Cancel on the "file already exists" prompt.
        // Deliberate skip — no error toast. The follow-up action
        // (export, share, etc.) still proceeds against the local
        // in-memory file, matching the "keep editing locally" intent.
      } else {
        toast.error({
          title: "Could not save",
          description: "We couldn't save your edits. Please try again.",
        });
      }
    }

    return ok;
  } finally {
    toast.close(loadingKey);
  }
}
