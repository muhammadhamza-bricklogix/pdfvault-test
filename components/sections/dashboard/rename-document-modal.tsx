"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useEffect, useState } from "react";

import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";

type Props = {
  document: Document | null;
  onClose: () => void;
};

export function RenameDocumentModal({ document: doc, onClose }: Props) {
  const [name, setName] = useState("");
  const rename = useRenameDocumentMutation();
  const isOpen = !!doc;

  useEffect(() => {
    if (doc) setName(doc.filename);
  }, [doc]);

  const handleSubmit = async () => {
    if (!doc) return;
    const trimmed = name.trim();

    if (!trimmed || trimmed === doc.filename) {
      onClose();

      return;
    }

    await rename.mutateAsync({ id: doc.id, filename: trimmed });
    onClose();
  };

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
              <TextField autoFocus value={name} onChange={setName}>
                <Label>Name</Label>
                <Input placeholder="Document name" />
              </TextField>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={rename.isPending || !name.trim()}
              onPress={() => void handleSubmit()}
            >
              {rename.isPending ? "Saving..." : "Save"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
