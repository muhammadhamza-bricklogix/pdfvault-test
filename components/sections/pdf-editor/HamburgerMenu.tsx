"use client";

import type { Key } from "@heroui/react";

import {
  Add01Icon,
  FolderOpenIcon,
  Menu01Icon,
  NoteIcon,
  SaveMoneyDollarIcon,
  FileExportIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";

const DISABLED_KEYS = new Set(["save", "export"]);

export function HamburgerMenu() {
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleAction = (key: Key) => {
    switch (key) {
      case "new":
        clearFile();
        break;
      case "open":
        fileInputRef.current?.click();
        break;
      case "my-pdfs":
        router.push(ROUTES.APP.DASHBOARD);
        break;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      clearFile();
      setTimeout(() => setFile(file), 0);
    }

    e.target.value = "";
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
          <Dropdown.Menu
            aria-label="Editor menu"
            disabledKeys={DISABLED_KEYS}
            onAction={handleAction}
          >
            <Dropdown.Item id="new" textValue="Create New">
              <HugeiconsIcon icon={Add01Icon} size={14} />
              <Label>Create New</Label>
            </Dropdown.Item>
            <Dropdown.Item id="open" textValue="Open File">
              <HugeiconsIcon icon={FolderOpenIcon} size={14} />
              <Label>Open File</Label>
            </Dropdown.Item>
            <Dropdown.Item id="save" textValue="Save">
              <HugeiconsIcon icon={SaveMoneyDollarIcon} size={14} />
              <Label>Save (Coming Soon)</Label>
            </Dropdown.Item>
            <Dropdown.Item id="export" textValue="Export">
              <HugeiconsIcon icon={FileExportIcon} size={14} />
              <Label>Export (Coming Soon)</Label>
            </Dropdown.Item>
            <Dropdown.Item id="my-pdfs" textValue="My PDFs">
              <HugeiconsIcon icon={NoteIcon} size={14} />
              <Label>My PDFs</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Separator className="!h-4" orientation="vertical" />
      <input
        ref={fileInputRef}
        accept="application/pdf"
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
    </>
  );
}
