"use client";

import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";

/**
 * Custom confirm dialog for keyboard-initiated reload (F5 / Cmd+R / Ctrl+R)
 * when the editor has unsaved changes. The keydown listener in
 * `use-editor-navigation-save.ts` cancels the browser reload and dispatches
 * `editor:show-reload-prompt`; this component listens for that event and
 * opens with three actions:
 *
 *   • Save & reload  — runs the standard `editor:save-before-action` flow
 *                      (uploads current edits), then reloads.
 *   • Reload anyway  — skips the save and reloads immediately. Sets the
 *                      module-level "suppress next unload" flag so the
 *                      browser's own beforeunload dialog doesn't appear
 *                      on top of ours.
 *   • Cancel         — closes the modal, stays on the page.
 *
 * The browser's OWN reload button (in the address bar) does not fire
 * keydown and cannot be intercepted; those clicks still show the native
 * "Reload site? Changes you made may not be saved." dialog.
 */
export function ReloadConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onShow = () => setIsOpen(true);

    window.addEventListener("editor:show-reload-prompt", onShow);

    return () => {
      window.removeEventListener("editor:show-reload-prompt", onShow);
    };
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSaving) return;
    setIsOpen(false);
  };

  const handleReloadAnyway = () => {
    suppressNextUnload();
    window.location.reload();
  };

  const handleSaveAndReload = async () => {
    setIsSaving(true);

    await new Promise<void>((resolve) => {
      window.dispatchEvent(
        new CustomEvent("editor:save-before-action", {
          detail: { force: true, onComplete: () => resolve() },
        }),
      );
    });

    // Reload without another beforeunload prompt. Post-save
    // `hasUnsavedChanges` should already be false, but suppress
    // defensively in case a stale-cache edge case flips the flag back.
    suppressNextUnload();
    window.location.reload();
  };

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[420px]">
          <Modal.Header>
            <Modal.Heading>Reload the page?</Modal.Heading>
          </Modal.Header>

          <Modal.Body>
            <p className="text-sm text-default-600">
              You have unsaved edits. Reloading will discard them unless you
              save first.
            </p>
          </Modal.Body>

          <Modal.Footer>
            <Button
              isDisabled={isSaving}
              variant="tertiary"
              onPress={handleClose}
            >
              Cancel
            </Button>
            <Button
              isDisabled={isSaving}
              variant="secondary"
              onPress={handleReloadAnyway}
            >
              Reload anyway
            </Button>
            <Button isDisabled={isSaving} onPress={handleSaveAndReload}>
              {isSaving ? "Saving…" : "Save & reload"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
