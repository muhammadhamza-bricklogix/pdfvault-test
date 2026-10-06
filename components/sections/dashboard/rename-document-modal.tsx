"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useState } from "react";

import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import {
  stripPdfExtension,
  validateRenameBaseName,
} from "@/lib/shared/schemas/documents/rename.schema";

type Props = {
  document: Document | null;
  onClose: () => void;
};

export function RenameDocumentModal({ document: doc, onClose }: Props) {
  // The field edits the name only; `.pdf` is a fixed suffix appended on save.
  const [name, setName] = useState(stripPdfExtension(doc?.filename ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  // React docs' "adjust state during render" pattern — resets `name` whenever
  // the modal is opened for a different document. Avoids the
  // setState-in-effect anti-pattern.
  const [lastDocId, setLastDocId] = useState<string | null>(doc?.id ?? null);

  if ((doc?.id ?? null) !== lastDocId) {
    setLastDocId(doc?.id ?? null);
    setName(stripPdfExtension(doc?.filename ?? ""));
    setError(null);
  }

  const rename = useRenameDocumentMutation();
  const isOpen = !!doc;

  // Live validation; `error` holds only the save-time duplicate message.
  // An unchanged name is always allowed so existing long names never get stuck.
  const isUnchanged =
    stripPdfExtension(name.trim()).trim() ===
    stripPdfExtension(doc?.filename ?? "");
  const validationError = isUnchanged ? null : validateRenameBaseName(name);
  const shownError = validationError ?? error;

  const handleChange = (val: string) => {
    setName(val);
    if (error) setError(null);
  };

  const handleSubmit = async () => {
    if (!doc || validationError) return;
    const trimmed = `${stripPdfExtension(name.trim()).trim()}.pdf`;

    if (trimmed === doc.filename) {
      onClose();

      return;
    }

    setCheckingDuplicate(true);
    try {
      const duplicate = await findDuplicateByFilename(trimmed);

      if (duplicate && duplicate.id !== doc.id) {
        setError("A document with this name already exists");

        return;
      }
    } catch {
      // Non-fatal — if the duplicate check itself fails, let the backend
      // adjudicate. Better to surface a rename-mutation error than block
      // the user on a transient list-fetch hiccup.
    } finally {
      setCheckingDuplicate(false);
    }

    await rename.mutateAsync({ id: doc.id, filename: trimmed });
    onClose();
  };

  const busy = rename.isPending || checkingDuplicate;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Rename document</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {/* `p-1` insets the TextField 4px from the Modal.Body edges so
                HeroUI's focus ring on the Input doesn't get shaved by the
                Modal.Dialog's rounded corners (bottom edge was clipping the
                ring — vertical inset is as necessary as the horizontal one). */}
            <form
              className="flex flex-col gap-3 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <TextField
                autoFocus
                isInvalid={!!shownError}
                value={name}
                onChange={handleChange}
              >
                <Label>Name</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Document name"
                  />
                  <span className="shrink-0 text-sm text-default-500">
                    .pdf
                  </span>
                </div>
                {shownError ? (
                  <p className="text-xs text-danger" role="alert">
                    {shownError}
                  </p>
                ) : null}
              </TextField>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={busy || !!validationError}
              onPress={() => void handleSubmit()}
            >
              {busy ? "Saving..." : "Save"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
