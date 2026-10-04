"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { NoteColorSwatches, NoteIconGlyph } from "./NoteIconGlyph";

import {
  DEFAULT_NOTE_COLOR,
  DEFAULT_NOTE_ICON,
  NOTE_ICONS,
  type NoteIconId,
} from "@/lib/client/pdf-editor/annotation-notes";

type AnnotationsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AnnotationsModal({
  isOpen,
  onClose,
}: AnnotationsModalProps): React.ReactElement {
  const [color, setColor] = useState(DEFAULT_NOTE_COLOR);
  const [lastIcon, setLastIcon] = useState<NoteIconId>(DEFAULT_NOTE_ICON);

  const onPick = (icon: NoteIconId): void => {
    setLastIcon(icon);
    window.dispatchEvent(
      new CustomEvent("editor:add-annotation", { detail: { color, icon } }),
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
        <Modal.Dialog className="!w-[92vw] !max-w-[460px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Annotations</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                Colour
              </p>
              <NoteColorSwatches value={color} onChange={setColor} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                Note shape
              </p>
              <ul
                aria-label="Note shapes"
                className="grid grid-cols-4 gap-2 sm:grid-cols-5"
              >
                {NOTE_ICONS.map((icon) => (
                  <li key={icon.id}>
                    <button
                      aria-label={`Add ${icon.label} note`}
                      className={`flex h-full w-full flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition hover:border-accent hover:bg-default-100 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        icon.id === lastIcon
                          ? "border-accent bg-default-100"
                          : "border-default-200 bg-default-50"
                      }`}
                      title={icon.label}
                      type="button"
                      onClick={() => onPick(icon.id)}
                    >
                      <NoteIconGlyph color={color} icon={icon.id} size={28} />
                      <span className="text-[11px] leading-tight text-default-700">
                        {icon.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
