"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Button, Modal } from "@heroui/react";

import { useBulkDeleteDocumentsMutation } from "@/lib/client/query/mutations/documents.mutation";

type Props = {
  documents: Document[] | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function BulkDeleteDocumentsModal({
  documents,
  onClose,
  onSuccess,
}: Props) {
  const remove = useBulkDeleteDocumentsMutation();
  const isOpen = Boolean(documents?.length);
  const count = documents?.length ?? 0;
  const preview = documents?.slice(0, 5) ?? [];
  const remaining = Math.max(0, count - preview.length);

  const handleConfirm = async () => {
    if (!documents?.length) return;

    await remove.mutateAsync({ ids: documents.map((d) => d.id) });

    onSuccess?.();
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
        <Modal.Dialog className="sm:max-w-[440px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {count === 1
                ? "Delete 1 document?"
                : `Delete ${count} documents?`}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-default-500">
              {count === 1
                ? "This cannot be undone. The following file will be removed:"
                : "This cannot be undone. The following files will be removed:"}
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-foreground)]">
              {preview.map((doc) => (
                <li key={doc.id} className="line-clamp-1">
                  {doc.filename}
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <p className="mt-2 text-xs text-default-500">
                and {remaining} more…
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={remove.isPending}
              variant="primary"
              onPress={() => void handleConfirm()}
            >
              {remove.isPending ? "Deleting…" : `Delete ${count}`}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
