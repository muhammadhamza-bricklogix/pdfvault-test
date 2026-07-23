"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useState } from "react";

import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { validateRenameFilename } from "@/lib/shared/schemas/documents/rename.schema";

type Props = {
  document: Document | null;
  onClose: () => void;
};

export function RenameDocumentModal({ document: doc, onClose }: Props) {
  const [name, setName] = useState(doc?.filename ?? "");
  const [error, setError] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  // React docs' "adjust state during render" pattern — resets `name` whenever
  // the modal is opened for a different document. Avoids the
  // setState-in-effect anti-pattern.
  const [lastDocId, setLastDocId] = useState<string | null>(doc?.id ?? null);

  if ((doc?.id ?? null) !== lastDocId) {
    setLastDocId(doc?.id ?? null);
    setName(doc?.filename ?? "");
    setError(null);
  }

  const rename = useRenameDocumentMutation();
  const isOpen = !!doc;

  const handleChange = (val: string) => {
    setName(val);
    if (error) setError(null);
  };

  const handleSubmit = async () => {
    if (!doc) return;
    const trimmed = name.trim();

    if (!trimmed || trimmed === doc.filename) {
      onClose();

      return;
    }

    const validationError = validateRenameFilename(trimmed);

    if (validationError) {
      setError(validationError);

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
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <TextField
                autoFocus
                isInvalid={!!error}
                value={name}
                onChange={handleChange}
              >
                <Label>Name</Label>
                <Input placeholder="Document name" />
                {error ? <p className="text-xs text-danger">{error}</p> : null}
              </TextField>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={busy || !name.trim()}
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
