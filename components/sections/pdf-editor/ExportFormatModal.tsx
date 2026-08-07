"use client";

import type { ExportFormat } from "@/lib/client/hooks/pdf-editor/use-export-editor";

import {
  Doc01Icon,
  FileImageIcon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

// 6 format tiles matching the reference in image #3 (PDF Guru / user
// spec): PDF, PNG, Word, Excel, JPG, PPTX. All route through the same
// editor:export event pipeline in useExportEditor.
type FormatOption = {
  id: Extract<ExportFormat, "pdf" | "docx" | "xlsx" | "pptx" | "jpg" | "png">;
  label: string;
  icon: typeof Pdf01Icon;
  iconClass: string;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    icon: Pdf01Icon,
    iconClass: "bg-red-100 text-red-600",
    id: "pdf",
    label: "PDF",
  },
  {
    icon: FileImageIcon,
    iconClass: "bg-orange-100 text-orange-600",
    id: "png",
    label: "PNG",
  },
  {
    icon: Doc01Icon,
    iconClass: "bg-blue-100 text-blue-600",
    id: "docx",
    label: "Word",
  },
  {
    icon: Doc01Icon,
    iconClass: "bg-emerald-100 text-emerald-600",
    id: "xlsx",
    label: "Excel",
  },
  {
    icon: FileImageIcon,
    iconClass: "bg-pink-100 text-pink-600",
    id: "jpg",
    label: "JPG",
  },
  {
    icon: FileImageIcon,
    iconClass: "bg-amber-100 text-amber-600",
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

  const handleDownload = () => {
    window.dispatchEvent(
      new CustomEvent("editor:export", {
        detail: { filename: fileName, format: selected },
      }),
    );
    onClose();
  };

  return (
    <Modal.Dialog className="!max-h-[calc(100dvh-32px)] !w-[92vw] !max-w-[560px] overflow-y-auto overscroll-contain">
      <Modal.CloseTrigger />
      <Modal.Header className="!pb-2 text-center">
        <Modal.Heading className="text-center text-2xl font-bold">
          Great Job!
        </Modal.Heading>
        <p className="mt-1 text-center text-sm text-default-500">
          Select the format to download your file.
        </p>
      </Modal.Header>

      <Modal.Body className="space-y-5">
        <div
          aria-label="Export format"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          role="radiogroup"
        >
          {FORMAT_OPTIONS.map((opt) => {
            const checked = selected === opt.id;

            return (
              <button
                key={opt.id}
                aria-checked={checked}
                className={`flex items-center justify-between rounded-lg border p-3 text-left transition ${
                  checked
                    ? "border-accent bg-accent/5 ring-2 ring-accent"
                    : "border-default-200 hover:bg-default-50"
                }`}
                role="radio"
                type="button"
                onClick={() => setSelected(opt.id)}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      checked ? "border-accent" : "border-default-300"
                    }`}
                  >
                    {checked && (
                      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className="text-base font-medium">{opt.label}</span>
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${opt.iconClass}`}
                >
                  <HugeiconsIcon icon={opt.icon} size={18} />
                </span>
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
        <Button isDisabled={!file} onPress={handleDownload}>
          Download
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
        {/* Remount the body each open so the format + name defaults are
            recomputed from the current file — avoids setState-in-effect
            reset patterns and cleanly discards the user's last-open edits
            when they cancel without shipping. */}
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
