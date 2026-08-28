"use client";

import type { ExportFormat } from "@/lib/client/hooks/pdf-editor/use-export-editor";

import {
  Doc01Icon,
  FileImageIcon,
  PencilEdit01Icon,
  Pdf01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

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
  const pathname = usePathname();
  // W-9 is a form product: only PDF is offered for now. Word (DOCX)
  // was temporarily wired through a PDF → DOCX conversion but was
  // removed per product on 2026-08-28 — user pinned scope to PDF only.
  // Every other format the picker would offer (PNG / Excel / JPG /
  // PPTX) has no server-side path from the finalize endpoint, so
  // filtering to PDF-only keeps the picker honest.
  const isW9Route = useMemo(
    () => pathname?.startsWith("/w-9-form") ?? false,
    [pathname],
  );
  const visibleOptions = useMemo(
    () =>
      isW9Route
        ? FORMAT_OPTIONS.filter((o) => o.id === "pdf")
        : FORMAT_OPTIONS,
    [isW9Route],
  );
  const [selected, setSelected] = useState<FormatOption["id"]>("pdf");
  const [fileName, setFileName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  const handleDownload = async () => {
    setIsSaving(true);

    // Two-step: cloud save FIRST (uploads current edits to the user's
    // library so nothing is lost), then export (bakes the same edits into
    // the downloaded file). `skipReset: true` is critical — it tells the
    // save handler NOT to swap `store.file` to the freshly uploaded bytes.
    //
    // WHY: `applyPostSaveReset` swaps the file, which triggers a pdf.js
    // reload + Fabric canvas remount. The subsequent `editor:export`
    // would then run its merge against the ALREADY-BAKED `savedFile`
    // while the live Fabric canvas still holds the pre-reset objects
    // (pristine=false editModeText, all shape/path/image overlays). The
    // export flush would overwrite the pristined store entry, and merge
    // would re-whitewash text (drift artefacts on the modified position)
    // AND re-draw every shape/path/image on top of savedFile's already-
    // baked copy — QA report 2026-08-19 "edited changes gone, some appear
    // at the very bottom" on any download format.
    //
    // With `skipReset: true` the local editor keeps operating on the
    // ORIGINAL file, so `editor:export` runs a single clean merge:
    // original file + all overlays (live-canvas + store) → baked bytes →
    // download. No double-bake, no race with pdf.js reload.
    await new Promise<void>((resolve) => {
      window.dispatchEvent(
        new CustomEvent("editor:save-before-action", {
          detail: { force: true, skipReset: true, onComplete: () => resolve() },
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
        {/* Editable file name — inline title style so users immediately
            see it's the output filename and can click to rename it. */}
        <div className="flex items-center gap-2 rounded-xl border border-default-200 bg-default-50 px-3 py-2.5">
          <TextField
            className="min-w-0 flex-1"
            value={fileName}
            onChange={setFileName}
          >
            <Input
              aria-label="File name"
              className="w-full truncate bg-transparent text-[15px] font-medium text-default-800 outline-none placeholder:text-default-400"
              id="export-file-name"
              placeholder="document"
            />
          </TextField>
          <HugeiconsIcon
            className="shrink-0 text-default-400"
            icon={PencilEdit01Icon}
            size={15}
          />
        </div>

        {/* Format tiles — grid width adapts to the number of visible
            options so a single PDF tile (W-9) fills full width, two
            tiles split 50/50, and the default 6 tiles stay 3-across. */}
        <div
          aria-label="Export format"
          className={`grid gap-3 ${
            visibleOptions.length === 1
              ? "grid-cols-1"
              : visibleOptions.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
          }`}
          role="radiogroup"
        >
          {visibleOptions.map((opt) => {
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
      </Modal.Body>

      <Modal.Footer className="justify-center">
        <Button
          className="w-[90%]"
          isDisabled={!file || isSaving}
          onPress={handleDownload}
        >
          {!isSaving && (
            <HugeiconsIcon className="text-white" icon={Tick01Icon} size={15} />
          )}
          {isSaving ? "Converting..." : "Download"}
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
