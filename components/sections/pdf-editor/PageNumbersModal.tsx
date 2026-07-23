"use client";

import type {
  PageNumberFormat,
  PageNumberPosition,
} from "@/lib/client/pdf-editor/add-page-numbers";

import { Button, Label, Modal } from "@heroui/react";
import { useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

const POSITIONS: { id: PageNumberPosition; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

const FORMATS: { id: PageNumberFormat; label: string; sample: string }[] = [
  { id: "n", label: "Number only", sample: "1" },
  { id: "page-n", label: "Page Number", sample: "Page 1" },
  { id: "n-of-N", label: "Number of Number", sample: "1 of 10" },
  { id: "page-n-of-N", label: "Page Number of Number", sample: "Page 1 of 10" },
  { id: "n-slash-N", label: "Number / Number", sample: "1/10" },
];

function hexToRgb01(hex: string): { b: number; g: number; r: number } {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  return { b, g, r };
}

export function PageNumbersModal() {
  const isOpen = usePdfEditorStore((s) => s.isPageNumbersModalOpen);

  if (!isOpen) return null;

  // Mounted only when open so useState captures the current pageCount each
  // time the user reopens the modal. Without this the initial endPage was
  // stuck at whatever pageCount was when the shell first mounted the modal
  // (often 1 or 0, before the PDF had loaded).
  return <PageNumbersModalContent />;
}

function PageNumbersModalContent() {
  const setIsOpen = usePdfEditorStore((s) => s.setIsPageNumbersModalOpen);
  const file = usePdfEditorStore((s) => s.file);
  const pageCount = usePdfEditorStore((s) => s.pageCount);

  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [format, setFormat] = useState<PageNumberFormat>("page-n-of-N");
  const [fontSize, setFontSize] = useState(12);
  const [margin, setMargin] = useState(24);
  const [colorHex, setColorHex] = useState("#000000");
  const [startNumber, setStartNumber] = useState(1);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(pageCount || 1);

  const handleClose = () => setIsOpen(false);

  const handleApply = () => {
    if (!file) return;

    const total = pageCount || 1;
    const safeStart = Math.max(1, Math.min(total, startPage));
    const safeEnd = Math.max(safeStart, Math.min(total, endPage));

    window.dispatchEvent(
      new CustomEvent("editor:add-page-numbers", {
        detail: {
          options: {
            color: hexToRgb01(colorHex),
            endPage: safeEnd,
            fontSize,
            format,
            margin,
            position,
            startNumber: Math.max(1, startNumber),
            startPage: safeStart,
          },
        },
      }),
    );
    handleClose();
  };

  const handleRemove = () => {
    if (!file) return;
    window.dispatchEvent(new CustomEvent("editor:remove-page-numbers"));
    handleClose();
  };

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[560px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add page numbers</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-5">
            <p className="text-xs text-default-500">
              {file
                ? `Stamping ${pageCount} pages • ${file.name}`
                : "Open a PDF to add page numbers."}
            </p>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                Position
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {POSITIONS.map((p) => {
                  const selected = position === p.id;

                  return (
                    <button
                      key={p.id}
                      aria-pressed={selected}
                      className={`rounded-lg border p-2 text-xs transition ${
                        selected
                          ? "border-accent bg-accent/5 ring-2 ring-accent"
                          : "border-default-200 hover:bg-default-50"
                      }`}
                      type="button"
                      onClick={() => setPosition(p.id)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                Format
              </legend>
              <div className="flex flex-col gap-2">
                {FORMATS.map((f) => {
                  const selected = format === f.id;

                  return (
                    <button
                      key={f.id}
                      aria-pressed={selected}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selected
                          ? "border-accent bg-accent/5 ring-2 ring-accent"
                          : "border-default-200 hover:bg-default-50"
                      }`}
                      type="button"
                      onClick={() => setFormat(f.id)}
                    >
                      <span>{f.label}</span>
                      <span className="text-xs text-default-500">
                        {f.sample}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  Font size
                </Label>
                <input
                  className="w-full rounded-md border border-default-200 px-3 py-2 text-sm"
                  max={72}
                  min={6}
                  type="number"
                  value={fontSize}
                  onChange={(e) =>
                    setFontSize(Math.max(6, Number(e.target.value) || 12))
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  Margin (pt)
                </Label>
                <input
                  className="w-full rounded-md border border-default-200 px-3 py-2 text-sm"
                  max={144}
                  min={0}
                  type="number"
                  value={margin}
                  onChange={(e) =>
                    setMargin(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  Color
                </Label>
                <input
                  className="h-10 w-full rounded-md border border-default-200 px-2"
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  Start at
                </Label>
                <input
                  className="w-full rounded-md border border-default-200 px-3 py-2 text-sm"
                  min={1}
                  type="number"
                  value={startNumber}
                  onChange={(e) =>
                    setStartNumber(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  First page
                </Label>
                <input
                  className="w-full rounded-md border border-default-200 px-3 py-2 text-sm"
                  max={pageCount}
                  min={1}
                  type="number"
                  value={startPage}
                  onChange={(e) =>
                    setStartPage(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-default-500">
                  Last page
                </Label>
                <input
                  className="w-full rounded-md border border-default-200 px-3 py-2 text-sm"
                  max={pageCount}
                  min={1}
                  type="number"
                  value={endPage}
                  onChange={(e) =>
                    setEndPage(Math.max(1, Number(e.target.value) || pageCount))
                  }
                />
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              isDisabled={!file}
              variant="tertiary"
              onPress={handleRemove}
            >
              Remove all
            </Button>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button isDisabled={!file} onPress={handleApply}>
              Add
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
