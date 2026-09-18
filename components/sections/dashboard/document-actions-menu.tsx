"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import {
  ArrowRight01Icon,
  Clock01Icon,
  Delete02Icon,
  Download01Icon,
  FileEditIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { VersionHistoryModal } from "@/components/sections/pdf-editor/VersionHistoryModal";
import { W9_LIBRARY_FILENAME } from "@/components/sections/forms/W9FinalizeIntercept";
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
  // 2026-09-01 (QA): the canonical W-9 row is a "system doc" — the
  // W-9 flow upserts into it forever, so deletion would strand the
  // user's saved W-9 (next open re-adopts the row and loses history).
  // Hide Delete + Rename for this filename; open / download / version
  // history stay available.
  const isProtectedSystemDoc =
    doc.filename.toLowerCase() === W9_LIBRARY_FILENAME.toLowerCase();

  const handleOpen = async () => {
    try {
      await openDocumentInEditor(router, doc);
    } catch (err) {
      toast.error({
        title: "Couldn't open file",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDownload = async () => {
    try {
      await triggerDocumentDownload(doc, router);
    } catch (err) {
      toast.error({
        title: "Download failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Primary CTA — Download. Row-level review 2026-09-17: users
          want the reward action visible on every row, not hidden in
          a menu. Every other action moves into the 3-dot overflow. */}
      <Button
        aria-label={`Download ${doc.filename}`}
        className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-[13px] font-semibold"
        size="sm"
        variant="primary"
        onPress={() => void handleDownload()}
      >
        <HugeiconsIcon icon={Download01Icon} size={14} />
        <span className="hidden sm:inline">Download</span>
      </Button>

      {/* Overflow menu — Open / History / Rename / Delete. Handlers
          untouched so the paywall gate in `openDocumentInEditor`
          (converted-PDF gate) and the delete-confirm modal continue
          to fire from the same call sites. */}
      <Dropdown>
        <Button
          aria-label={`More actions for ${doc.filename}`}
          className="!h-8 !w-8 !min-w-0 shrink-0 rounded-full text-default-600"
          size="sm"
          variant="ghost"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </Button>
        <Dropdown.Popover className="min-w-[180px]" placement="bottom end">
          <Dropdown.Menu aria-label={`Actions for ${doc.filename}`}>
            <Dropdown.Item
              id="open"
              textValue="Open"
              onAction={() => void handleOpen()}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              <Label>Open</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="history"
              textValue="Version history"
              onAction={() => setIsHistoryOpen(true)}
            >
              <HugeiconsIcon icon={Clock01Icon} size={16} />
              <Label>Version history</Label>
            </Dropdown.Item>
            {isProtectedSystemDoc ? null : (
              <Dropdown.Item id="rename" textValue="Rename" onAction={onRename}>
                <HugeiconsIcon icon={FileEditIcon} size={16} />
                <Label>Rename</Label>
              </Dropdown.Item>
            )}
            {isProtectedSystemDoc ? null : (
              <Dropdown.Item
                className="text-danger"
                id="delete"
                textValue="Delete"
                onAction={onDelete}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
                <Label>Delete</Label>
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

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
