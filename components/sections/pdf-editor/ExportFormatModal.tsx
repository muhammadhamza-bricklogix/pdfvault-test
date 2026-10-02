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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { usePdfEditorStore } from "@/lib/client/stores";

type FormatOption = {
  id: Extract<ExportFormat, "pdf" | "docx" | "xlsx" | "pptx" | "jpg" | "png">;
  label: string;
  ext: string;
  icon: typeof Pdf01Icon;
  iconBg: string;
  iconColor: string;
};

// Order matters — the format tiles render in this order into a 2-column
// grid (2026-08-29 PM), so row 1 = PDF + Word, row 2 = PNG + JPG.
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
    ext: ".docx",
    icon: Doc01Icon,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    id: "docx",
    label: "Word",
  },
  {
    ext: ".png",
    icon: FileImageIcon,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    id: "png",
    label: "PNG",
  },
  // Excel + PPTX hidden 2026-08-28 pending future work on those
  // conversion pipelines. Do not remove; re-enable by uncommenting
  // when the pipelines are ready.
  // {
  //   ext: ".xlsx",
  //   icon: Doc01Icon,
  //   iconBg: "bg-emerald-50",
  //   iconColor: "text-emerald-500",
  //   id: "xlsx",
  //   label: "Excel",
  // },
  {
    ext: ".jpg",
    icon: FileImageIcon,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-500",
    id: "jpg",
    label: "JPG",
  },
  // {
  //   ext: ".pptx",
  //   icon: FileImageIcon,
  //   iconBg: "bg-amber-50",
  //   iconColor: "text-amber-500",
  //   id: "pptx",
  //   label: "PPTX",
  // },
];

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");

  return dot > 0 ? name.slice(0, dot) : name;
}

function toEditorPdfName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) return null;
  const baseName = trimmed.replace(/\.[^./\\]+$/, "").trim();

  return baseName ? `${baseName}.pdf` : null;
}

type ExportFormatModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function ExportFormatModalBody({
  fileName,
  setFileName,
  onClose,
}: {
  fileName: string;
  setFileName: (name: string) => void;
  onClose: () => void;
}) {
  const file = usePdfEditorStore((s) => s.file);
  // Currently-open doc — a self-match on filename shouldn't count as
  // a duplicate; that's just the user re-downloading their own row.
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const pathname = usePathname();
  // W-9 offers PDF plus image formats (PNG / JPG). Image branches route
  // the stamped PDF through `conversionService` (pdf_to_png / pdf_to_jpg)
  // in `W9FinalizeIntercept` after finalize returns the byte-perfect
  // server-stamped PDF. Word / Excel / PPTX are intentionally excluded
  // for now — DOCX was removed per product on 2026-08-28.
  // 1099-NEC is PDF-only — `NecFinalizeIntercept` has no image branch.
  const isNecRoute = useMemo(
    () =>
      Boolean(
        pathname?.startsWith("/1099-nec-form") ||
          pathname?.startsWith("/forms/1099-nec"),
      ),
    [pathname],
  );
  const isW9Route = useMemo(
    () =>
      Boolean(
        pathname?.startsWith("/w-9-form") || pathname?.startsWith("/forms/w-9"),
      ) || isNecRoute,
    [pathname, isNecRoute],
  );
  const W9_ALLOWED_FORMATS = useMemo(
    () =>
      isNecRoute
        ? new Set<FormatOption["id"]>(["pdf"])
        : new Set<FormatOption["id"]>(["pdf", "png", "jpg"]),
    [isNecRoute],
  );
  const visibleOptions = useMemo(
    () =>
      isW9Route
        ? FORMAT_OPTIONS.filter((o) => W9_ALLOWED_FORMATS.has(o.id))
        : FORMAT_OPTIONS,
    [isW9Route, W9_ALLOWED_FORMATS],
  );
  const [selected, setSelected] = useState<FormatOption["id"]>("pdf");
  const [isSaving, setIsSaving] = useState(false);
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  const scrollFileNameInputIntoView = useCallback(
    (block: ScrollLogicalPosition = "nearest") => {
      fileNameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block,
        inline: "nearest",
      });
    },
    [],
  );

  const focusFileNameInput = useCallback(() => {
    const input = fileNameInputRef.current;

    if (!input) return;

    input.focus({ preventScroll: true });
    input.select();
    requestAnimationFrame(() => scrollFileNameInputIntoView("nearest"));
    window.setTimeout(() => scrollFileNameInputIntoView("center"), 250);
  }, [scrollFileNameInputIntoView]);

  useEffect(() => {
    const visualViewport = window.visualViewport;

    if (!visualViewport) return;

    const handleViewportResize = () => {
      if (document.activeElement !== fileNameInputRef.current) return;

      scrollFileNameInputIntoView("center");
    };

    visualViewport.addEventListener("resize", handleViewportResize);

    return () =>
      visualViewport.removeEventListener("resize", handleViewportResize);
  }, [scrollFileNameInputIntoView]);

  // Duplicate-name check against the user's My PDFs library. Only
  // runs on the W-9 route per product ask 2026-08-29 — the shell
  // composer's Download flow uses `currentDocumentId`-based upserts
  // and doesn't need this guard. Debounced 400 ms so the list-endpoint
  // isn't hit on every keystroke, and cancellable so a rapid-fire
  // rename doesn't race an older lookup back into view.
  //
  // Stored state is the filename we last observed as a duplicate /
  // are actively checking; the render flags below derive from those.
  // Using stored-filename-strings keeps the whole thing pure — no
  // synchronous set-state-in-effect calls needed when the input
  // changes.
  const [duplicateFor, setDuplicateFor] = useState<string | null>(null);
  const [checkingFor, setCheckingFor] = useState<string | null>(null);
  const activeCheckId = useRef(0);
  // Library row is ALWAYS `<base>.pdf` regardless of the download
  // format the user picks (image/word downloads are derived from the
  // stamped PDF that lands in My PDFs). So the duplicate check runs
  // against `.pdf` even when the user selected PNG / JPG / Word.
  const fullFilename = useMemo(() => {
    const trimmed = fileName.trim();

    if (!trimmed) return "";
    const base = trimmed.replace(/\.[^./\\]+$/, "");

    return `${base}.pdf`;
  }, [fileName]);
  const duplicateExists =
    duplicateFor !== null && duplicateFor === fullFilename;
  const checkingDuplicate =
    checkingFor !== null && checkingFor === fullFilename && !duplicateExists;

  useEffect(() => {
    if (!isW9Route || !fullFilename) return;

    const checkFor = fullFilename;
    const checkId = ++activeCheckId.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      // "checking" flag flips ON only when the debounce fires — the
      // 400 ms window before that isn't user-perceptible latency, so
      // no need to show a spinner just because they haven't paused
      // typing. Set here (inside an async callback) rather than in
      // the effect body to satisfy `react-hooks/set-state-in-effect`.
      if (cancelled || checkId !== activeCheckId.current) return;
      setCheckingFor(checkFor);
      try {
        const match = await findDuplicateByFilename(checkFor);

        if (cancelled || checkId !== activeCheckId.current) return;
        // A hit on the currently-open doc isn't a real duplicate —
        // that's the row we'd upsert into anyway. Only flag rows
        // that belong to a DIFFERENT document.
        const isRealDuplicate =
          match !== null && match.id !== currentDocumentId;

        setDuplicateFor(isRealDuplicate ? checkFor : null);
      } catch {
        // Network / auth failures don't block download — user can
        // still ship the file. Silent so an unrelated 401 doesn't
        // spawn a scary red banner in the download modal.
        if (cancelled || checkId !== activeCheckId.current) return;
        setDuplicateFor(null);
      } finally {
        if (!cancelled && checkId === activeCheckId.current) {
          setCheckingFor(null);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fullFilename, isW9Route, currentDocumentId]);

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
    //
    // Gate the export on save.ok: if the pre-save fails (e.g. Firefox
    // AbortError inside merge-pdf), dispatching editor:export re-runs the
    // exact same failing pipeline and the user sees a misleading "Export
    // failed" toast on top of the real "Could not save" one. `saveBeforeAction`
    // already surfaces the correct error toast on failure — short-circuit
    // here and let onClose fall through so the user isn't stuck in the modal.
    const saveResult = await new Promise<{
      ok: boolean;
      reason?: string;
    }>((resolve) => {
      window.dispatchEvent(
        new CustomEvent("editor:save-before-action", {
          detail: {
            force: true,
            skipReset: true,
            onComplete: (result: { ok: boolean; reason?: string }) =>
              resolve(result),
          },
        }),
      );
    });

    // Allow the export to fire when save.ok, OR when save was skipped
    // for the benign "not-signed-in" reason. Rationale:
    //
    //   • ok = true → normal signed-in path, edits uploaded, safe to
    //     bake + download.
    //   • reason = "not-signed-in" → guest user; `onSaveBeforeAction`
    //     correctly skipped the cloud save (they have no library
    //     row). We MUST still dispatch `editor:export` because
    //     `useExportEditor` is the code that fires the email-first /
    //     sign-in prompt (auth-chain items 3-4). Without this branch
    //     the guest clicks Done → picks format → clicks Download →
    //     modal closes silently and nothing happens (QA 2026-09-10).
    //
    // All other failure reasons (error, not-loaded, cancelled-
    // duplicate) stay gated — `onSaveBeforeAction` has already
    // surfaced the correct error toast; re-running the same pipeline
    // via `editor:export` would either double-toast or repeat the
    // exact same failure (Firefox AbortError inside merge-pdf, etc.
    // — the original reason this gate exists).
    const shouldFireExport =
      saveResult.ok || saveResult.reason === "not-signed-in";

    if (shouldFireExport) {
      window.dispatchEvent(
        new CustomEvent("editor:export", {
          detail: { filename: fileName, format: selected },
        }),
      );
    }

    setIsSaving(false);
    onClose();
  };

  return (
    <Modal.Dialog className="!max-h-[calc(100dvh-32px)] !w-[92vw] !max-w-[520px] overflow-y-auto overscroll-contain">
      <Modal.CloseTrigger />
      <Modal.Header className="!pb-3 text-center">
        <Modal.Heading className="text-center text-xl font-bold">
          Your file is ready
        </Modal.Heading>
        <p className="mt-1 text-center text-sm text-default-500">
          Your changes are saved. Choose a format to download.
        </p>
      </Modal.Header>

      <Modal.Body className="space-y-5">
        {/* Format tiles — grid width adapts to the number of visible
            options. 1 tile → full width; exactly 3 tiles (W-9: PDF /
            JPG / PNG) → one row of 3 per 2026-08-29 late-PM request;
            everything else uses 2-across. Moved above the File name
            input per QA 2026-09-05 so the modal reads top-to-bottom as
            "pick format → confirm name → Download". */}
        <div
          aria-label="Export format"
          className={`grid gap-3 ${
            visibleOptions.length === 1
              ? "grid-cols-1"
              : visibleOptions.length === 3
                ? "grid-cols-3"
                : "grid-cols-2"
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

        {/* Editable file name — moved BELOW the format tiles + given an
            explicit "File name" title per the QA 2026-09-05 design
            reference. W-9 route also runs a debounced duplicate-name
            check against the user's My PDFs library (see effect above). */}
        <div>
          <label
            className="mb-1.5 block px-1 text-[13px] font-medium text-default-600"
            htmlFor="export-file-name"
          >
            File name
          </label>
          <div
            className={`flex items-center gap-2 rounded-xl border bg-default-50 px-3 py-2.5 ${
              duplicateExists
                ? "border-danger-500 bg-danger-50"
                : "border-default-200"
            }`}
          >
            <TextField
              className="min-w-0 flex-1"
              value={fileName}
              onChange={setFileName}
            >
              <Input
                ref={fileNameInputRef}
                aria-invalid={duplicateExists}
                aria-label="File name"
                className="w-full truncate bg-transparent text-[15px] font-medium text-default-800 outline-none placeholder:text-default-400"
                id="export-file-name"
                placeholder="document"
                onFocus={() => scrollFileNameInputIntoView("nearest")}
              />
            </TextField>
            <button
              aria-label="Rename file"
              className="shrink-0 rounded p-0.5 text-default-400 transition-colors hover:bg-default-200 hover:text-default-700"
              type="button"
              onClick={focusFileNameInput}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} size={15} />
            </button>
          </div>
          {isW9Route && duplicateExists ? (
            <p className="mt-1.5 px-1 text-[12px] text-danger" role="alert">
              A file named <span className="font-semibold">{fullFilename}</span>{" "}
              already exists in My PDFs. Rename to keep both copies.
            </p>
          ) : isW9Route && checkingDuplicate ? (
            <p className="mt-1.5 px-1 text-[12px] text-default-400">
              Checking name…
            </p>
          ) : null}
        </div>
      </Modal.Body>

      {/* Cancel + Download side-by-side per QA 2026-09-05 design ref.
          Cancel simply dismisses the modal (no side effects) — matches
          the reference image; download flow is unchanged. */}
      <Modal.Footer className="!flex-row !gap-3 !px-6 !pt-2">
        <Button
          className="flex-1"
          isDisabled={isSaving}
          variant="secondary"
          onPress={onClose}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          isDisabled={!file || isSaving || duplicateExists}
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
  const setFile = usePdfEditorStore((s) => s.setFile);
  const initialName = file ? stripExt(file.name) : "document";

  // fileName is lifted to this parent (not ExportFormatModalBody) so a typed rename
  // survives the body remounting on each open/close of the same file.
  const [fileName, setFileName] = useState(initialName);
  const lastFileRef = useRef(file);

  // Only reset fileName when the file itself changes, not on every open. Done in an
  // effect rather than during render since the React Compiler lint disallows reading
  // a ref at render time.
  useEffect(() => {
    if (file !== lastFileRef.current) {
      lastFileRef.current = file;
      setFileName(initialName);
    }
  }, [file, initialName]);

  const syncFileName = useCallback(
    (nextName: string) => {
      setFileName(nextName);

      const nextFileName = toEditorPdfName(nextName);
      const currentFile = usePdfEditorStore.getState().file;

      if (!currentFile || !nextFileName || currentFile.name === nextFileName) {
        return;
      }

      setFile(
        new File([currentFile], nextFileName, {
          lastModified: currentFile.lastModified,
          type: currentFile.type,
        }),
      );
    },
    [setFile],
  );

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
            key={`${file?.size ?? 0}::${file?.lastModified ?? 0}::${isOpen}`}
            fileName={fileName}
            setFileName={syncFileName}
            onClose={onClose}
          />
        )}
      </Modal.Container>
    </Modal.Backdrop>
  );
}
