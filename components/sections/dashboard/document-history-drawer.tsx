"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Edit01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer, toast } from "@heroui/react";
import { useEffect, useState } from "react";

import { VersionPreviewModal } from "@/components/sections/pdf-editor/VersionPreviewModal";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { formatRelativeTime } from "@/lib/shared/utils/audit-format";
import { logger } from "@/lib/shared/utils/logger";

type Props = {
  documentId: string | null;
  documentName: string;
  isOpen: boolean;
  onClose: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Slide-in drawer that shows the per-document save history. Until the
 * backend exposes a dedicated audit-event read API, we hydrate this
 * drawer from `listVersions` — each version snapshot is one entry in the
 * timeline, ordered newest-first. The "Current" row at the top reflects
 * the live document state so users see a continuous timeline rather
 * than an empty list when the backend's `/audit` endpoint isn't wired
 * up. See `audit.service.ts` for the legacy audit hook (kept around so
 * we can swap back when the audit-read API ships).
 */
export function DocumentHistoryDrawer({
  documentId,
  documentName,
  isOpen,
  onClose,
}: Props) {
  const [versions, setVersions] = useState<Document[]>([]);
  const [current, setCurrent] = useState<Document | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  // Compare-with-current modal state. `previewVersion` is the version
  // the user clicked "Compare" on; we pair it with the live `current`
  // doc inside the modal and let the user paginate both side-by-side.
  const [previewVersion, setPreviewVersion] = useState<Document | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen || !documentId) {
      setStatus("idle");
      setVersions([]);
      setCurrent(null);

      return;
    }

    let cancelled = false;

    setStatus("loading");
    void (async () => {
      try {
        const [versionList, currentDoc] = await Promise.all([
          documentsService.listVersions(documentId),
          documentsService.getDocument(documentId),
        ]);

        if (cancelled) return;
        setVersions(versionList);
        setCurrent(currentDoc);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        logger.error("Failed to load document history", err);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId, reloadKey]);

  const handleConfirmRestore = async () => {
    if (!documentId || !previewVersion) return;
    setRestoring(true);
    try {
      await documentsService.restoreVersion(documentId, previewVersion.id);
      toast(`Restored to version ${previewVersion.version}.`);
      setPreviewVersion(null);
      // Re-fetch the version list + current so the drawer reflects the
      // post-restore state (current is now the restored bytes; the prior
      // state has been snapshotted as a new version per backend rules).
      setReloadKey((k) => k + 1);
    } catch (err) {
      logger.error("Failed to restore version", err);
      toast.danger("Couldn't restore that version. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="!w-[min(420px,100vw)]">
            <Drawer.Header>
              <Drawer.Heading>History</Drawer.Heading>
              <p className="truncate text-xs text-default-500">
                {documentName}
              </p>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3 p-4">
              {status === "loading" && (
                <p className="py-6 text-center text-sm text-default-500">
                  Loading history…
                </p>
              )}
              {status === "error" && (
                <p className="py-6 text-center text-sm text-danger">
                  Failed to load history.
                </p>
              )}
              {status === "ready" && versions.length === 0 && !current && (
                <p className="py-6 text-center text-sm text-default-500">
                  No history yet for this document.
                </p>
              )}
              {status === "ready" && (current || versions.length > 0) && (
                <ul className="flex flex-col gap-2">
                  {current && (
                    <li className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                        <HugeiconsIcon icon={Edit01Icon} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Current · v{current.version}
                        </p>
                        <p className="text-xs text-default-500">
                          <time dateTime={current.updatedAt}>
                            {formatRelativeTime(current.updatedAt)}
                          </time>
                          {` · ${formatSize(current.sizeBytes)}`}
                        </p>
                      </div>
                    </li>
                  )}
                  {versions.map((v) => {
                    const isInitial = v.version === 1;
                    const Icon = isInitial ? Upload01Icon : Edit01Icon;
                    const tint = isInitial
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-amber-500/10 text-amber-500";

                    return (
                      <li
                        key={v.id}
                        className="flex items-start gap-3 rounded-lg border border-default-200 p-3"
                      >
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-md ${tint}`}
                        >
                          <HugeiconsIcon icon={Icon} size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {isInitial ? "Original upload" : `Version ${v.version}`}
                          </p>
                          <p className="text-xs text-default-500">
                            <time dateTime={v.createdAt}>
                              {formatRelativeTime(v.createdAt)}
                            </time>
                            {` · ${formatSize(v.sizeBytes)}`}
                          </p>
                        </div>
                        <Button
                          aria-label={`Compare version ${v.version} with current`}
                          className="shrink-0"
                          size="sm"
                          variant="tertiary"
                          onPress={() => setPreviewVersion(v)}
                        >
                          Compare
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="tertiary" onPress={onClose}>
                Close
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <VersionPreviewModal
        currentUrl={current?.url ?? null}
        isOpen={!!previewVersion}
        onClose={() => {
          if (!restoring) setPreviewVersion(null);
        }}
        onConfirmRestore={handleConfirmRestore}
        restoring={restoring}
        versionLabel={
          previewVersion
            ? previewVersion.version === 1
              ? "Original upload"
              : `Version ${previewVersion.version}`
            : ""
        }
        versionUrl={previewVersion?.url ?? null}
      />
    </Drawer>
  );
}
