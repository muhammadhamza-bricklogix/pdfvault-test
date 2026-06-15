"use client";

import type { Key } from "@heroui/react";

import {
  Add01Icon,
  FileExportIcon,
  FileMinusIcon,
  FolderOpenIcon,
  LayersIcon,
  LockedIcon,
  Menu01Icon,
  NoteIcon,
  Search01Icon,
  Share01Icon,
  TaskDone01Icon,
  TextNumberSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { DuplicateUploadModal } from "@/components/sections/dashboard/duplicate-upload-modal";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { useFlattenFileMutation } from "@/lib/client/query/mutations";
import { useUploadWithDuplicateCheck } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { toast } from "@/lib/shared/utils/toast";

import { ShareModal } from "./ShareModal";

export function HamburgerMenu() {
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const setIsPasswordModalOpen = usePdfEditorStore(
    (s) => s.setIsPasswordModalOpen,
  );
  const setIsFindReplaceOpen = usePdfEditorStore((s) => s.setIsFindReplaceOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const setIsPageNumbersModalOpen = usePdfEditorStore(
    (s) => s.setIsPageNumbersModalOpen,
  );
  const setIsFormFieldsModalOpen = usePdfEditorStore(
    (s) => s.setIsFormFieldsModalOpen,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const router = useRouter();
  const { duplicate, start } = useUploadWithDuplicateCheck();
  const flatten = useFlattenFileMutation();

  const requireFile = (action: string): File | null => {
    if (!file) {
      toast.info({
        title: "No PDF open",
        description: `Open or create a PDF before ${action}.`,
      });

      return null;
    }

    return file;
  };

  const runFlatten = async () => {
    const f = requireFile("flattening");

    if (!f) return;
    try {
      const result = await flatten.mutateAsync({ file: f });

      triggerBlobDownload(result.blob, result.fileName);
    } catch {
      // toast already shown by the mutation
    }
  };

  const runExtractImages = () => {
    if (!requireFile("extracting images")) return;
    // Defer to the editor-shell-mounted hook (`useExtractImagesEditor`) so
    // the request goes out against the user's CURRENT edited PDF (overlays
    // baked) rather than the original upload. Without this any images the
    // user added through the editor's image tool wouldn't be in the bytes
    // we POST and the backend would return 400 / "no images found".
    window.dispatchEvent(new CustomEvent("editor:extract-images"));
  };

  const requireSignIn = () => {
    toast.info({
      title: "Sign in required",
      description: "Sign in to access your saved PDFs.",
    });
  };

  const handleAction = (key: Key) => {
    switch (key) {
      case "new":
        setIsCreatePdfModalOpen(true);
        break;
      case "open":
        fileInputRef.current?.click();
        break;
      case "my-pdfs":
        if (!isSignedIn) {
          requireSignIn();

          return;
        }
        window.dispatchEvent(
          new CustomEvent("editor:navigate-after-save", {
            detail: { url: ROUTES.APP.DASHBOARD },
          }),
        );
        break;
      case "compress":
        if (!requireFile("compressing")) return;
        setIsCompressModalOpen(true);
        break;
      case "password":
        if (!requireFile("setting a password")) return;
        setIsPasswordModalOpen(true);
        break;
      case "flatten":
        void runFlatten();
        break;
      case "extract-images":
        runExtractImages();
        break;
      case "find-replace":
        if (!requireFile("searching")) return;
        setIsFindReplaceOpen(true);
        break;
      case "page-numbers":
        if (!requireFile("adding page numbers")) return;
        setIsPageNumbersModalOpen(true);
        break;
      case "form-fields":
        if (!requireFile("filling form fields")) return;
        setIsFormFieldsModalOpen(true);
        break;
      case "share": {
        if (!requireFile("sharing")) return;
        if (!isSignedIn) {
          requireSignIn();

          return;
        }
        // Bake current edits into the cloud-saved PDF FIRST. Without
        // this the share modal would upload `store.file`, which is the
        // original upload — recipients would see the un-edited PDF.
        // `saveBeforeAction` short-circuits when there are no unsaved
        // changes, so this is free if the user already saved.
        void (async () => {
          const ok = await saveBeforeAction(
            "Saving your edits before generating a share link.",
          );

          if (ok) setIsShareOpen(true);
        })();
        break;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];

    e.target.value = "";
    if (!selected) return;

    const isAlreadyPdf = selected.type === "application/pdf";
    const loadingKey = isAlreadyPdf
      ? null
      : toast.loading({
          description: `Preparing ${selected.name} for the editor.`,
          title: "Converting to PDF",
        });

    let file: File;

    try {
      file = await uploadAsPdf(selected);
    } catch (err) {
      toast.error({
        description: err instanceof Error ? err.message : undefined,
        title: "Couldn't open file",
      });

      return;
    } finally {
      if (loadingKey) toast.close(loadingKey);
    }

    if (isSignedIn) {
      // Cloud upload + open the new doc in this editor when ready.
      void start({
        file,
        onOpen: (id) => router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${id}`),
      });

      return;
    }

    // Signed-out: local-only — preserve previous behavior.
    clearFile();
    setTimeout(() => setFile(file), 0);
  };

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          aria-label="Editor menu"
          size="sm"
          variant="tertiary"
        >
          <HugeiconsIcon icon={Menu01Icon} size={16} />
        </Button>
        <Dropdown.Popover className="min-w-[200px]">
          <Dropdown.Menu aria-label="Editor menu" onAction={handleAction}>
            <Dropdown.Item id="new" textValue="Create New">
              <HugeiconsIcon icon={Add01Icon} size={14} />
              <Label>Create New</Label>
            </Dropdown.Item>
            <Dropdown.Item id="open" textValue="Open File">
              <HugeiconsIcon icon={FolderOpenIcon} size={14} />
              <Label>Open File</Label>
            </Dropdown.Item>
            <Dropdown.Item
              className={isSignedIn ? "" : "text-default-400 opacity-60"}
              id="my-pdfs"
              textValue="My PDFs"
            >
              <HugeiconsIcon icon={NoteIcon} size={14} />
              <Label>My PDFs</Label>
            </Dropdown.Item>
            <Dropdown.Item id="compress" textValue="Compress PDF">
              <HugeiconsIcon icon={FileMinusIcon} size={14} />
              <Label>Compress PDF</Label>
            </Dropdown.Item>
            <Dropdown.Item id="password" textValue="Password protect">
              <HugeiconsIcon icon={LockedIcon} size={14} />
              <Label>Password protect</Label>
            </Dropdown.Item>
            <Dropdown.Item id="flatten" textValue="Flatten form fields">
              <HugeiconsIcon icon={LayersIcon} size={14} />
              <Label>Flatten form fields</Label>
            </Dropdown.Item>
            <Dropdown.Item id="extract-images" textValue="Extract images">
              <HugeiconsIcon icon={FileExportIcon} size={14} />
              <Label>Extract images (ZIP)</Label>
            </Dropdown.Item>
            <Dropdown.Item id="find-replace" textValue="Find and replace">
              <HugeiconsIcon icon={Search01Icon} size={14} />
              <Label>Find &amp; Replace (⌘F)</Label>
            </Dropdown.Item>
            <Dropdown.Item id="page-numbers" textValue="Add page numbers">
              <HugeiconsIcon icon={TextNumberSignIcon} size={14} />
              <Label>Add page numbers</Label>
            </Dropdown.Item>
            <Dropdown.Item id="form-fields" textValue="Fill form fields">
              <HugeiconsIcon icon={TaskDone01Icon} size={14} />
              <Label>Fill form fields</Label>
            </Dropdown.Item>
            <Dropdown.Item id="share" textValue="Share via link">
              <HugeiconsIcon icon={Share01Icon} size={14} />
              <Label>Share via link</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Separator className="!h-4" orientation="vertical" />
      <input
        ref={fileInputRef}
        accept={UPLOAD_ACCEPT_MIME.join(",")}
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
      <DuplicateUploadModal
        filename={duplicate?.filename ?? null}
        onIgnore={duplicate?.onIgnore ?? (() => undefined)}
        onOverwrite={duplicate?.onOverwrite ?? (() => undefined)}
      />
      <ShareModal
        file={file}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </>
  );
}
