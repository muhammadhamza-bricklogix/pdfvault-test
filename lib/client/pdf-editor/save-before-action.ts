import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

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
 *   - save failed         → resolve false, caller shows error
 *
 * Shows a loading toast while the save is in flight.
 */
export async function saveBeforeAction(
  description = "Saving your edits…",
): Promise<boolean> {
  if (!usePdfEditorStore.getState().hasUnsavedChanges) return true;

  const loadingKey = toast.loading({
    title: "Saving…",
    description,
  });

  try {
    const { ok } = await new Promise<{ ok: boolean }>((resolve) => {
      window.dispatchEvent(
        new CustomEvent("editor:save-before-action", {
          detail: { onComplete: resolve },
        }),
      );
    });

    if (!ok) {
      toast.error({
        title: "Could not save",
        description: "We couldn't save your edits. Please try again.",
      });
    }

    return ok;
  } finally {
    toast.close(loadingKey);
  }
}
