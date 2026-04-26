"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Button, Modal } from "@heroui/react";

import { useDeleteDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";

type Props = {
    document: Document | null;
    onClose: () => void;
};

export function DeleteDocumentModal({ document: doc, onClose }: Props) {
    const remove = useDeleteDocumentMutation();
    const isOpen = !!doc;

    const handleConfirm = async () => {
        if (!doc) return;
        await remove.mutateAsync({ id: doc.id });
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
                        <Modal.Heading>Delete document?</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <p className="text-sm text-[var(--app-muted)]">
                            {doc ? (
                                <>
                                    This will permanently delete{" "}
                                    <span className="font-medium text-[var(--color-foreground)]">
                                        {doc.name}
                                    </span>
                                    . This cannot be undone.
                                </>
                            ) : null}
                        </p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button slot="close" variant="secondary">
                            Cancel
                        </Button>
                        <Button
                            isDisabled={remove.isPending}
                            variant="danger"
                            onPress={() => void handleConfirm()}
                        >
                            {remove.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
