"use client";

import type { PageSizePreset } from "@/lib/client/pdf-editor/page-size-presets";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { PAGE_SIZE_PRESETS } from "@/lib/client/pdf-editor/page-size-presets";

type PageResizeDialogProps = {
  isOpen: boolean;
  selectedCount: number;
  onApply: (preset: PageSizePreset) => void;
  onClose: () => void;
};

export function PageResizeDialog({
  isOpen,
  onApply,
  onClose,
  selectedCount,
}: PageResizeDialogProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("a4");

  const handleApply = () => {
    const preset = PAGE_SIZE_PRESETS.find((p) => p.id === selectedPresetId);

    if (!preset) return;

    onApply(preset);
    onClose();
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className="max-w-md">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Resize page</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="gap-4">
            <p className="text-sm text-default-500">
              Choose a page size for{" "}
              {selectedCount === 1
                ? "the selected page"
                : `${selectedCount} selected pages`}
              . Content is scaled to fit and centered.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_SIZE_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;

                return (
                  <button
                    key={preset.id}
                    aria-pressed={isSelected}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                      isSelected
                        ? "border-[var(--color-accent)] bg-accent/10 ring-1 ring-[var(--color-accent)]"
                        : "border-default-200 bg-[var(--color-background)] hover:bg-default-100"
                    }`}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                  >
                    <span className="font-medium text-foreground">
                      {preset.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-default-500">
                      {preset.widthPt} × {preset.heightPt} pt
                    </span>
                  </button>
                );
              })}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onPress={handleApply}>
              Apply
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
