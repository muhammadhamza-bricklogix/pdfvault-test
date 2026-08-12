"use client";

import type { ExportFormat } from "@/lib/client/hooks/pdf-editor/use-export-editor";

import {
  Doc01Icon,
  FileImageIcon,
  Pdf01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type FormatOption = {
  id: Extract<ExportFormat, "pdf" | "docx" | "xlsx" | "pptx" | "jpg" | "png">;
  label: string;
  ext: string;
  icon: typeof Pdf01Icon;
  iconBg: string;
  iconColor: string;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    ext: ".pdf",
    icon: Pdf01Icon,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    id: "pdf",
    label: "PDF",
  },
  {
    ext: ".png",
    icon: FileImageIcon,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    id: "png",
    label: "PNG",
  },
  {
    ext: ".docx",
    icon: Doc01Icon,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    id: "docx",
    label: "Word",
  },
  {
    ext: ".xlsx",
    icon: Doc01Icon,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    id: "xlsx",
    label: "Excel",
  },
  {
    ext: ".jpg",
    icon: FileImageIcon,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-500",
    id: "jpg",
    label: "JPG",
  },
  {
    ext: ".pptx",
    icon: FileImageIcon,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    id: "pptx",
    label: "PPTX",
  },
];

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");

  return dot > 0 ? name.slice(0, dot) : name;
}

type ExportFormatModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function ExportFormatModalBody({
  initialName,
  onClose,
}: {
  initialName: string;
  onClose: () => void;
}) {
  const file = usePdfEditorStore((s) => s.file);
  const [selected, setSelected] = useState<FormatOption["id"]>("pdf");
  const [fileName, setFileName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  const handleDownload = async () => {
    setIsSaving(true);

    await new Promise<void>((resolve) => {
      window.dispatchEvent(
        new CustomEvent("editor:save-before-action", {
          detail: { force: false, onComplete: () => resolve() },
        }),
      );
    });

    window.dispatchEvent(
      new CustomEvent("editor:export", {
        detail: { filename: fileName, format: selected },
      }),
    );

    onClose();
  };

  return (
    <Modal.Dialog className="!max-h-[calc(100dvh-32px)] !w-[92vw] !max-w-[520px] overflow-y-auto overscroll-contain">
      <Modal.CloseTrigger />
      <Modal.Header className="!pb-3 text-center">
        <Modal.Heading className="text-center text-xl font-bold">
          Download File
        </Modal.Heading>
        <p className="mt-1 text-center text-sm text-default-500">
          Choose a format to export your document.
        </p>
      </Modal.Header>

      <Modal.Body className="space-y-5">
        {/* Format tiles — 3-column grid of visual cards */}
        <div
          aria-label="Export format"
          className="grid grid-cols-3 gap-3"
          role="radiogroup"
        >
          {FORMAT_OPTIONS.map((opt) => {
            const checked = selected === opt.id;

            return (
              <button
                key={opt.id}
                aria-checked={checked}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${
                  checked
                    ? "border-[#f12c23] bg-red-50 shadow-sm"
                    : "border-default-200 hover:border-default-300 hover:bg-default-50"
                }`}
                role="radio"
                type="button"
                onClick={() => setSelected(opt.id)}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${opt.iconBg} ${opt.iconColor}`}
                >
                  <HugeiconsIcon icon={opt.icon} size={26} />
                </span>
                <span
                  className={`text-sm font-semibold ${checked ? "text-[#f12c23]" : "text-default-700"}`}
                >
                  {opt.label}
                </span>
                <span className="text-[11px] text-default-400">{opt.ext}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-[var(--color-foreground)]"
            htmlFor="export-file-name"
          >
            File name
          </label>
          <TextField value={fileName} onChange={setFileName}>
            <Input id="export-file-name" placeholder="document" />
          </TextField>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button slot="close" variant="secondary">
          Cancel
        </Button>
        <Button isDisabled={!file || isSaving} onPress={handleDownload}>
          {!isSaving && (
            <HugeiconsIcon className="text-white" icon={Tick01Icon} size={15} />
          )}
          {isSaving ? "Saving…" : "Done"}
        </Button>
      </Modal.Footer>
    </Modal.Dialog>
  );
}

export function ExportFormatModal({ isOpen, onClose }: ExportFormatModalProps) {
  const file = usePdfEditorStore((s) => s.file);
  const initialName = file ? stripExt(file.name) : "document";

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className="items-start justify-center p-4 sm:items-center">
        {isOpen && (
          <ExportFormatModalBody
            key={`${initialName}::${isOpen}`}
            initialName={initialName}
            onClose={onClose}
          />
        )}
      </Modal.Container>
    </Modal.Backdrop>
  );
}
