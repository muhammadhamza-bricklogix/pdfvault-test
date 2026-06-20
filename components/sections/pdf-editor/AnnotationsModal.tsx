"use client";

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
            <p className="text-xs text-default-500">
              Pick a stamp to drop onto the current page. After it lands, drag
              to position, double-click to edit, or use the text toolbar to
              change colour and size.
            </p>

            <ul
              aria-label="Annotation choices"
              className="grid grid-cols-4 gap-2"
            >
              {ANNOTATIONS.map((a) => (
                <li key={a.id}>
                  <button
                    aria-label={a.label}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-default-200 bg-default-50 transition hover:border-accent hover:bg-default-100 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    type="button"
                    onClick={() => onPick(a.id)}
                  >
                    <span
                      className="text-2xl leading-none"
                      style={{ color: a.fill }}
                    >
                      {a.glyph}
                    </span>
                    <span className="text-[10px] text-default-500">
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
