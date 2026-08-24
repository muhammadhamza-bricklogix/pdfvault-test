"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import {
  ArrowRight01Icon,
  Clock01Icon,
  Delete02Icon,
  Download01Icon,
  FileEditIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { VersionHistoryModal } from "@/components/sections/pdf-editor/VersionHistoryModal";
import { openDocumentInEditor } from "@/lib/client/utils/open-document-in-editor";
import { triggerDocumentDownload } from "@/lib/client/utils/trigger-document-download";
import { documentKeys } from "@/lib/shared/constants/query-keys";
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
  const queryClient = useQueryClient();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleOpen = async () => {
    try {
      await openDocumentInEditor(router, doc.id);
    } catch (err) {
      toast.error({
        title: "Couldn't open file",
        description: err instanceof Error ? err.message : undefined,
      });
    }
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
          onPress={() => void handleOpen()}
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
          aria-label={`View history for ${doc.filename}`}
          className="text-default-600"
          size="sm"
          variant="ghost"
          onPress={() => setIsHistoryOpen(true)}
        >
          <HugeiconsIcon icon={Clock01Icon} size={16} />
        </Button>
        <Tooltip.Content>
          <p>History</p>
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
      <VersionHistoryModal
        documentId={isHistoryOpen ? doc.id : null}
        isOpen={isHistoryOpen}
        // After a successful restore, refresh the documents table so
        // updatedAt / size / version on this row reflect the restored
        // state (mirrors the editor's onRestored which reloads the
        // editor with the new bytes). Also refresh the per-doc detail
        // cache used by other dashboard surfaces.
        onClose={() => setIsHistoryOpen(false)}
        onRestored={() => {
          void queryClient.invalidateQueries({
            queryKey: documentKeys.lists(),
          });
          void queryClient.invalidateQueries({
            queryKey: documentKeys.detail(doc.id),
          });
        }}
      />
    </div>
  );
}
