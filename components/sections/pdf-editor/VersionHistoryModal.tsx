"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import {
  ArchiveRestoreIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { useEffect, useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { validateRenameFilename } from "@/lib/shared/schemas/documents/rename.schema";
import { toast } from "@/lib/shared/utils/toast";

import { VersionPreviewModal } from "./VersionPreviewModal";

type VersionHistoryModalProps = {
  /** Root document id (the one the user is currently editing). */
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called after a successful restore. Parent reloads the editor with
   * the restored bytes — see `HamburgerMenu`'s wiring.
   *
   * `restoredFileUrl` is the immutable version-snapshot URL so the parent
   * doesn't have to rely on the root document URL, which may still point to
   * the pre-restore bytes immediately after the restore API returns.
   */
  onRestored?: (restored: Document, restoredFileUrl: string) => void;
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

/**
 * Base display name for a version row. We reuse the `filename` column —
 * users can rename via the existing `PATCH /documents/:id/rename`
 * endpoint, and the change is purely cosmetic (S3 key + restore
 * mechanics don't depend on it).
 */
function getVersionLabel(v: Document): string {
  return v.filename?.trim() ? v.filename : `Version ${v.version}`;
}

/**
 * Label shown in the version list, appending "(current)" to the root
 * document row so the user's latest saved state is clearly identified.
 */
function getVersionDisplayLabel(v: Document, rootId?: string | null): string {
  const base = getVersionLabel(v);

  return v.id === rootId ? `${base} (current)` : base;
}

export function VersionHistoryModal({
  documentId,
  isOpen,
  onClose,
  onRestored,
}: VersionHistoryModalProps): React.ReactElement {
  const [versions, setVersions] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  // Preview-before-restore flow: clicking Restore opens the preview
  // modal first; the user confirms there.
  const [previewVersion, setPreviewVersion] = useState<Document | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Inline rename for each version row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const [data, root] = await Promise.all([
          documentsService.listVersions(documentId),
          documentsService.getDocument(documentId),
        ]);

        if (cancelled) return;

        // Surface the current root document as the first row. The backend
        // version list is a history of snapshots, so the latest saved state
        // lives on the root doc, not in a snapshot row. Without this, users
        // can't find a version row that contains their most recent edits.
        const merged = root
          ? [root, ...data.filter((v) => v.id !== root.id)]
          : data;

        setVersions(merged);
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

  // Revoke any blob URL we created for the current preview so the browser
  // doesn't accumulate object URLs each time the user previews a version.
  useEffect(() => {
    return () => {
      if (currentUrl?.startsWith("blob:")) URL.revokeObjectURL(currentUrl);
    };
  }, [currentUrl]);

  const openPreview = async (version: Document): Promise<void> => {
    if (!documentId) return;
    setPreviewVersion(version);
    // Drop the previous current preview URL so the pane re-renders.
    // Blob URLs created from the local file are revoked here to avoid
    // leaking object URLs every time the preview opens.
    setCurrentUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);

      return null;
    });

    try {
      // Refresh the version row to get a freshly-signed URL. The URL
      // returned by `listVersions` can be reused/cached by the browser,
      // so fetching the snapshot directly busts any stale response and
      // ensures the candidate preview shows the real version bytes.
      const refreshedVersion = await documentsService.getDocument(version.id);

      if (refreshedVersion) {
        setPreviewVersion(refreshedVersion);
      }

      // Prefer the local, already-merged file when it matches the doc
      // we are previewing. This guarantees the "Current" pane reflects
      // the editor's actual bytes (including the latest draw/signature
      // edits) and avoids any signed-URL / CDN cache staleness that can
      // make the preview look like an older version.
      const state = usePdfEditorStore.getState();
      const localFile = state.file;

      if (localFile && state.currentDocumentId === documentId) {
        setCurrentUrl(URL.createObjectURL(localFile));
      } else {
        // Fall back to a fresh signed URL for the root doc if the local
        // file isn't available (e.g. the modal was opened from outside
        // the editor).
        const current = await documentsService.getDocument(documentId);

        setCurrentUrl(current.url ?? null);
      }
    } catch {
      // Non-fatal — the preview pane will just show the loading
      // spinner. User can still confirm restore.
    }
  };

  const closePreview = (): void => {
    if (restoring) return;
    setPreviewVersion(null);
    setCurrentUrl(null);
  };

  const confirmRestore = async (): Promise<void> => {
    if (!documentId || !previewVersion) return;
    setRestoring(true);
    try {
      const restored = await documentsService.restoreVersion(
        documentId,
        previewVersion.id,
      );

      toast.success({
        title: "Restored",
        description: "The editor will reload with the restored version.",
      });
      // Pass the immutable snapshot URL; the root document URL may still
      // point at the pre-restore bytes for a short window after the API
      // returns, so using the snapshot URL avoids showing the old PDF.
      onRestored?.(restored, previewVersion?.url ?? restored.url);
      setPreviewVersion(null);
      setCurrentUrl(null);
      onClose();
    } catch {
      toast.error({
        title: "Restore failed",
        description: "Couldn't restore this version. Please try again.",
      });
    } finally {
      setRestoring(false);
    }
  };

  const startEditing = (v: Document): void => {
    setEditingId(v.id);
    setEditingValue(getVersionLabel(v));
    setEditingError(null);
  };

  const cancelEditing = (): void => {
    setEditingId(null);
    setEditingValue("");
    setEditingError(null);
  };

  const handleEditingChange = (val: string): void => {
    setEditingValue(val);
    if (editingError) setEditingError(null);
  };

  const saveRename = async (v: Document): Promise<void> => {
    const next = editingValue.trim();

    if (!next || next === getVersionLabel(v)) {
      cancelEditing();

      return;
    }

    const validationError = validateRenameFilename(next);

    if (validationError) {
      setEditingError(validationError);

      return;
    }
    setRenamingId(v.id);
    try {
      const updated = await documentsService.renameDocument({
        id: v.id,
        filename: next,
      });

      setVersions((prev) =>
        prev.map((x) =>
          x.id === v.id
            ? ({ ...x, filename: updated.filename ?? next } as Document)
            : x,
        ),
      );
      cancelEditing();
    } catch {
      toast.error({
        title: "Couldn't rename version",
        description: "Please try again.",
      });
    } finally {
      setRenamingId(null);
    }
  };

  return (
    <>
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
                Every Save creates a new version. Click the pencil to rename a
                version, or Restore to preview and roll back.
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
                  {versions.map((v) => {
                    const isEditing = editingId === v.id;
                    const isRenaming = renamingId === v.id;

                    return (
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
                          {isEditing ? (
                            <TextField
                              isDisabled={isRenaming}
                              isInvalid={isEditing && !!editingError}
                              value={editingValue}
                              onChange={handleEditingChange}
                            >
                              <Input
                                autoFocus
                                aria-label="Version name"
                                placeholder={`Version ${v.version}`}
                                onKeyDown={(
                                  e: React.KeyboardEvent<HTMLInputElement>,
                                ) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void saveRename(v);
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEditing();
                                  }
                                }}
                              />
                              {isEditing && editingError ? (
                                <p className="text-xs text-danger">
                                  {editingError}
                                </p>
                              ) : null}
                            </TextField>
                          ) : (
                            <>
                              <p className="truncate text-sm font-medium">
                                {getVersionDisplayLabel(v, documentId)}
                              </p>
                              <p className="text-xs text-default-500">
                                v{v.version} · {formatDate(v.createdAt)} ·{" "}
                                {formatBytes(v.sizeBytes)}
                              </p>
                            </>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button
                              aria-label="Save name"
                              isDisabled={isRenaming}
                              size="sm"
                              variant="secondary"
                              onPress={() => void saveRename(v)}
                            >
                              <HugeiconsIcon
                                icon={CheckmarkCircle02Icon}
                                size={14}
                              />
                              {isRenaming ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              aria-label="Cancel rename"
                              isDisabled={isRenaming}
                              size="sm"
                              variant="tertiary"
                              onPress={cancelEditing}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              aria-label="Rename version"
                              size="sm"
                              variant="tertiary"
                              onPress={() => startEditing(v)}
                            >
                              <HugeiconsIcon
                                icon={PencilEdit01Icon}
                                size={14}
                              />
                            </Button>
                            <Button
                              isDisabled={previewVersion !== null || restoring}
                              size="sm"
                              variant="secondary"
                              onPress={() => void openPreview(v)}
                            >
                              <HugeiconsIcon
                                icon={ArchiveRestoreIcon}
                                size={14}
                              />
                              Restore
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
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

      <VersionPreviewModal
        currentUrl={currentUrl}
        isOpen={previewVersion !== null}
        restoring={restoring}
        versionLabel={
          previewVersion
            ? getVersionDisplayLabel(previewVersion, documentId)
            : "Version"
        }
        versionUrl={previewVersion?.url ?? null}
        onClose={closePreview}
        onConfirmRestore={confirmRestore}
      />
    </>
  );
}
