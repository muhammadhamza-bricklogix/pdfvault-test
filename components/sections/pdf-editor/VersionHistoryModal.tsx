"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { ArchiveRestoreIcon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { toast } from "@/lib/shared/utils/toast";

type VersionHistoryModalProps = {
  /** Root document id (the one the user is currently editing). */
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called after a successful restore. Parent reloads the editor with
   * the restored bytes — see `HamburgerMenu`'s wiring.
   */
  onRestored?: (restored: Document) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);

  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VersionHistoryModal({
  documentId,
  isOpen,
  onClose,
  onRestored,
}: VersionHistoryModalProps): React.ReactElement {
  const [versions, setVersions] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await documentsService.listVersions(documentId);

        if (!cancelled) setVersions(data);
      } catch {
        if (!cancelled) {
          toast.error({
            title: "Couldn't load version history",
            description: "Try closing and re-opening the modal.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId]);

  const onRestore = async (versionId: string): Promise<void> => {
    if (!documentId) return;
    setRestoringId(versionId);
    try {
      const restored = await documentsService.restoreVersion(
        documentId,
        versionId,
      );

      toast.success({
        title: "Restored",
        description:
          "The editor will reload with the restored version. Your pre-restore state was kept as a new version.",
      });
      onRestored?.(restored);
      onClose();
    } catch {
      toast.error({
        title: "Restore failed",
        description: "Couldn't restore this version. Please try again.",
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[560px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Version history</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-2">
            <p className="text-xs text-default-500">
              Every Save creates a new version. Restoring rolls the document
              back to that point — your current state is kept as a new version
              so restore is reversible.
            </p>

            {loading && (
              <p className="py-8 text-center text-sm text-default-500">
                Loading versions…
              </p>
            )}

            {!loading && versions.length === 0 && (
              <p className="py-8 text-center text-sm text-default-500">
                No versions yet. Save the document at least once to start a
                version history.
              </p>
            )}

            {!loading && versions.length > 0 && (
              <ul className="-mx-2 max-h-[50vh] overflow-y-auto">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 rounded-lg border border-default-200 px-3 py-2 hover:bg-default-50"
                  >
                    <HugeiconsIcon
                      className="text-default-400"
                      icon={Clock01Icon}
                      size={18}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        Version {v.version}
                      </p>
                      <p className="text-xs text-default-500">
                        {formatDate(v.createdAt)} · {formatBytes(v.sizeBytes)}
                      </p>
                    </div>
                    <Button
                      isDisabled={restoringId !== null}
                      size="sm"
                      variant="secondary"
                      onPress={() => void onRestore(v.id)}
                    >
                      <HugeiconsIcon icon={ArchiveRestoreIcon} size={14} />
                      {restoringId === v.id ? "Restoring…" : "Restore"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
