"use client";

import type { Key } from "@heroui/react";

import {
  Add01Icon,
  FolderOpenIcon,
  Menu01Icon,
  NoteIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { useTrackedUpload } from "@/lib/client/hooks/upload/use-tracked-upload";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

export function HamburgerMenu() {
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { start } = useTrackedUpload();

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
      start({
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
    </>
  );
}
