"use client";

import { NoteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";

import {
  ANNOTATIONS,
  type AnnotationId,
} from "@/lib/client/hooks/pdf-editor/use-annotations-editor";

type AnnotationsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AnnotationsModal({
  isOpen,
  onClose,
}: AnnotationsModalProps): React.ReactElement {
  const onPick = (id: AnnotationId): void => {
    window.dispatchEvent(
      new CustomEvent("editor:add-annotation", { detail: { id } }),
    );
    onClose();
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[420px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Annotations</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-3">
            <ul
              aria-label="Annotation choices"
              className="grid grid-cols-1 gap-2"
            >
              {ANNOTATIONS.map((a) => (
                <li key={a.id}>
                  <button
                    aria-label={a.label}
                    className="flex w-full items-center gap-3 rounded-lg border border-default-200 bg-default-50 p-3 text-left transition hover:border-accent hover:bg-default-100 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    type="button"
                    onClick={() => onPick(a.id)}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#2B74E8] bg-[#FFD633] text-slate-900">
                      <HugeiconsIcon icon={NoteIcon} size={20} />
                    </span>
                    <span className="text-sm font-medium text-default-900">
                      {a.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
