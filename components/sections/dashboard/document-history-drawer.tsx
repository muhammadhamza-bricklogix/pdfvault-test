"use client";

import type { AuditAction, AuditEvent } from "@/lib/shared/types/audit.types";

import {
  Delete02Icon,
  Download01Icon,
  Edit01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer } from "@heroui/react";

import { useDocumentAuditQuery } from "@/lib/client/query/queries/audit.query";
import {
  describeAuditEvent,
  formatRelativeTime,
} from "@/lib/shared/utils/audit-format";

const ACTION_ICON: Record<AuditAction, typeof Upload01Icon> = {
  DOCUMENT_CREATED: Upload01Icon,
  DOCUMENT_UPDATED: Edit01Icon,
  DOCUMENT_DOWNLOADED: Download01Icon,
  DOCUMENT_DELETED: Delete02Icon,
};

const ACTION_TINT: Record<AuditAction, string> = {
  DOCUMENT_CREATED: "bg-blue-500/10 text-blue-500",
  DOCUMENT_UPDATED: "bg-amber-500/10 text-amber-500",
  DOCUMENT_DOWNLOADED: "bg-emerald-500/10 text-emerald-500",
  DOCUMENT_DELETED: "bg-rose-500/10 text-rose-500",
};

type Props = {
  documentId: string | null;
  documentName: string;
  isOpen: boolean;
  onClose: () => void;
};

function HistoryRow({ event }: { event: AuditEvent }) {
  const Icon = ACTION_ICON[event.action];
  return (
    <li className="flex items-start gap-3 rounded-lg border border-default-200 p-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${ACTION_TINT[event.action]}`}
      >
        <HugeiconsIcon icon={Icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{describeAuditEvent(event)}</p>
        <p className="text-xs text-default-500">
          <time dateTime={event.createdAt}>
            {formatRelativeTime(event.createdAt)}
          </time>
          {event.ipAddress ? ` · ${event.ipAddress}` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * Slide-in drawer showing the audit trail for a single document. Mounted
 * by parent components conditionally (lazy-loads `useInfiniteQuery` only
 * when `isOpen && documentId` are both truthy via `enabled` flag).
 */
export function DocumentHistoryDrawer({
  documentId,
  documentName,
  isOpen,
  onClose,
}: Props) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useDocumentAuditQuery(documentId, { enabled: isOpen });

  const events = data?.pages.flatMap((p) => p.items) ?? [];

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
              {isLoading && (
                <p className="py-6 text-center text-sm text-default-500">
                  Loading history…
                </p>
              )}
              {isError && (
                <p className="py-6 text-center text-sm text-danger">
                  Failed to load history.
                </p>
              )}
              {!isLoading && !isError && events.length === 0 && (
                <p className="py-6 text-center text-sm text-default-500">
                  No history yet for this document.
                </p>
              )}
              {events.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {events.map((event) => (
                    <HistoryRow key={event.id} event={event} />
                  ))}
                </ul>
              )}
              {hasNextPage && (
                <Button
                  isDisabled={isFetchingNextPage}
                  size="sm"
                  variant="tertiary"
                  onPress={() => fetchNextPage()}
                >
                  {isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
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
    </Drawer>
  );
}
