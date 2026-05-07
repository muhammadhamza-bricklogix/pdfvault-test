"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import {
  ArrowRight01Icon,
  Delete02Icon,
  Download01Icon,
  FileEditIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useRouter } from "next/navigation";

import { triggerDocumentDownload } from "@/lib/client/utils/trigger-document-download";
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

  const handleOpen = () => {
    router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${doc.id}`);
  };

  const handleDownload = async () => {
    try {
      await triggerDocumentDownload(doc);
    } catch (err) {
      toast.error({
        title: "Download failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip delay={300}>
        <Button
          isIconOnly
          aria-label={`Open ${doc.filename}`}
          className="text-default-600"
          size="sm"
          variant="ghost"
          onPress={handleOpen}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
        </Button>
        <Tooltip.Content>
          <p>Open</p>
        </Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300}>
        <Button
          isIconOnly
          aria-label={`Download ${doc.filename}`}
          className="text-default-600"
          size="sm"
          variant="ghost"
          onPress={() => void handleDownload()}
        >
          <HugeiconsIcon icon={Download01Icon} size={16} />
        </Button>
        <Tooltip.Content>
          <p>Download</p>
        </Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300}>
        <Button
          isIconOnly
          aria-label={`Rename ${doc.filename}`}
          className="text-default-600"
          size="sm"
          variant="ghost"
          onPress={onRename}
        >
          <HugeiconsIcon icon={FileEditIcon} size={16} />
        </Button>
        <Tooltip.Content>
          <p>Rename</p>
        </Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300}>
        <Button
          isIconOnly
          aria-label={`Delete ${doc.filename}`}
          className="text-danger"
          size="sm"
          variant="ghost"
          onPress={onDelete}
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
        </Button>
        <Tooltip.Content>
          <p className="text-danger">Delete</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
