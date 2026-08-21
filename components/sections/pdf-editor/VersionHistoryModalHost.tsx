"use client";

import { useAuth } from "@clerk/nextjs";

import { reloadEditorFromDocument } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

import { VersionHistoryModal } from "./VersionHistoryModal";

/**
 * Shell-level host for `VersionHistoryModal` so the modal survives the
 * `EditorLayout` unmount that fires during the pre-open pdf.js reload.
 *
 * The Version History flow runs `saveBeforeAction` first
 * (`HamburgerMenu.case "version-history"`) to make sure the latest edits
 * appear as the "Current" snapshot in the history list. That save calls
 * `applyPostSaveReset` which swaps `store.file` → `usePdfLoader` clears
 * `pdfDocument` → `EditorLayout` returns `<EditorLoadingShell />` for
 * the duration of the pdf.js reload. Any modal held in `HamburgerMenu`'s
 * local `useState` gets destroyed on that unmount, so
 * `setIsVersionsOpen(true)` fires on a stale instance and the modal
 * never appears — the exact same class of bug the ShareModal 2026-08-21
 * refactor solved.
 *
 * Mounting the modal at the shell level (siblings of the shell's own
 * modals like `PasswordModal`) keeps its state alive across the
 * unmount. Open state lives in the store; the restore callback still
 * needs Clerk's `userId` for `reloadEditorFromDocument`, so we read
 * `useAuth` here.
 */
export function VersionHistoryModalHost() {
  const { userId } = useAuth();
  const isOpen = usePdfEditorStore((s) => s.isVersionHistoryModalOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsVersionHistoryModalOpen);
  const documentId = usePdfEditorStore((s) => s.currentDocumentId);

  return (
    <VersionHistoryModal
      documentId={documentId}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onRestored={(restored, restoredFileUrl) => {
        void reloadEditorFromDocument(restored, userId, restoredFileUrl).catch(
          (err) => {
            toast.error({
              title: "Couldn't reload restored version",
              description:
                err instanceof Error
                  ? err.message
                  : "Please refresh to see the restored version.",
            });
          },
        );
      }}
    />
  );
}
