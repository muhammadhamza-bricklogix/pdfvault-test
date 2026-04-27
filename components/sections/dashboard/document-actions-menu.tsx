"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label } from "@heroui/react";
import { useRouter } from "next/navigation";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

type Props = {
  document: Document;
  onDelete: () => void;
  onRename: () => void;
};

export function DocumentActionsMenu({
  document: doc,
  onDelete,
  onRename,
}: Props) {
  const router = useRouter();

  const handleAction = async (key: React.Key) => {
    switch (key) {
      case "open":
        router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${doc.id}`);
        break;
      case "download":
        try {
          const { url } = await documentsService.getDocument(doc.id);
          const a = window.document.createElement("a");

          a.href = url;
          a.download = doc.filename;
          a.target = "_blank";
          a.rel = "noopener";
          window.document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          toast.error({
            title: "Download failed",
            description: err instanceof Error ? err.message : undefined,
          });
        }
        break;
      case "rename":
        onRename();
        break;
      case "delete":
        onDelete();
        break;
    }
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <Dropdown>
        <Button
          isIconOnly
          aria-label={`Actions for ${doc.filename}`}
          size="sm"
          variant="ghost"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu onAction={handleAction}>
            <Dropdown.Item id="open" textValue="Open">
              <Label>Open</Label>
            </Dropdown.Item>
            <Dropdown.Item id="download" textValue="Download">
              <Label>Download</Label>
            </Dropdown.Item>
            <Dropdown.Item id="rename" textValue="Rename">
              <Label>Rename</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Delete" variant="danger">
              <Label>Delete</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
