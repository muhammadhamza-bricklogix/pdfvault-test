"use client";

import type { AuditAction, AuditEvent } from "@/lib/shared/types/audit.types";

import {
  Clock01Icon,
  Delete02Icon,
  Download01Icon,
  Edit01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";

import { useAuditQuery } from "@/lib/client/query/queries/audit.query";
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

function ActivityRow({ event }: { event: AuditEvent }) {
  const Icon = ACTION_ICON[event.action];

  return (
    <li className="flex items-start gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] p-4">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${ACTION_TINT[event.action]}`}
      >
        <HugeiconsIcon icon={Icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-foreground)]">
          {describeAuditEvent(event)}
        </p>
        <p className="mt-0.5 truncate text-xs text-default-500">
          {event.documentId
            ? `Document ${event.documentId.slice(0, 8)}…`
            : "Document removed"}
          {" · "}
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
 * Paginated infinite-scroll feed of every audit event for the signed-in user.
 * Powered by `GET /api/v1/audit`. The "Load more" button drives the
 * useInfiniteQuery cursor; React Query handles caching + dedupe across
 * mounts of this page.
 */
export function ActivityFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useAuditQuery();

  const events = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-default-200/60 text-default-600">
          <HugeiconsIcon icon={Clock01Icon} size={18} />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Activity</h1>
          <p className="text-sm text-default-500">
            Every upload, edit, download, and delete on your account.
          </p>
        </div>
      </header>

      {isLoading && (
        <p className="py-10 text-center text-sm text-default-500">
          Loading activity…
        </p>
      )}

      {isError && (
        <p className="py-10 text-center text-sm text-danger">
          Could not load activity. Please refresh and try again.
        </p>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <p className="py-10 text-center text-sm text-default-500">
          No activity yet — upload or edit a document to see it here.
        </p>
      )}

      {events.length > 0 && (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            isDisabled={isFetchingNextPage}
            size="sm"
            variant="tertiary"
            onPress={() => fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
