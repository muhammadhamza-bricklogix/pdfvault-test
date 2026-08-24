"use client";

import { usePdfEditorStore } from "@/lib/client/stores";

import { MergePdfModal } from "./MergePdfModal";

/**
 * Shell-level host for the Merge modal. Kept OUT of `HamburgerMenu`
 * because the pre-merge `saveBeforeAction` triggers `applyPostSaveReset`
 * → pdf.js reload → `EditorLayout` briefly renders `<EditorLoadingShell />`
 * → `HamburgerMenu` unmounts. Local `useState` there is wiped, so the
 * `setIsMergeOpen(true)` call after save fires on a dead component and
 * the modal never appears. Reading open state + source from the store
 * (mounted here at shell level) survives the unmount cycle — same
 * pattern as `ShareModal` / `VersionHistoryModalHost`.
 */
export function MergeModalHost() {
  const isOpen = usePdfEditorStore((s) => s.isMergeModalOpen);
  const source = usePdfEditorStore((s) => s.mergeModalSource);
  const setIsOpen = usePdfEditorStore((s) => s.setIsMergeModalOpen);
  const setSource = usePdfEditorStore((s) => s.setMergeModalSource);

  return (
    <MergePdfModal
      isOpen={isOpen}
      source={source}
      onClose={() => {
        setIsOpen(false);
        setTimeout(() => setSource(null), 200);
      }}
    />
  );
}
