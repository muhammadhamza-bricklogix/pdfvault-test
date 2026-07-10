"use client";

import { Skeleton } from "@heroui/react";

/**
 * Editor placeholder shown while a document referenced by `?id=` is loading.
 * Mirrors the chrome layout so heights/positions don't shift on hydration.
 */
export function EditorLoadingShell() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-4">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-[26px] w-[104px] rounded" />
        <span aria-hidden className="mx-1 h-6 w-px bg-default-200" />
        <Skeleton className="h-4 w-40 flex-1 rounded" />
        <div className="ml-3 flex shrink-0 items-center gap-2 rounded-full border border-default-200 bg-white px-2 py-1.5">
          <Skeleton className="size-6 rounded-full" />
          <span aria-hidden className="h-4 w-px bg-default-200" />
          <Skeleton className="size-6 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          aria-label="Page thumbnails"
          className="flex w-44 shrink-0 flex-col border-r border-default-200 bg-default-100 px-2 pb-2 pt-0"
        >
          <div className="flex items-center justify-center px-0 py-3">
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-md" />
            ))}
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden bg-[var(--pv-canvas,#f5f5f7)]">
          <div className="flex shrink-0 items-center justify-center gap-3 overflow-x-auto bg-[var(--pv-canvas,#f5f5f7)] px-3 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-[200px] rounded-[16px]" />
            ))}
          </div>
          <div className="flex flex-1 items-start justify-center overflow-hidden bg-default-100 p-6">
            <Skeleton className="h-[calc(100%-2rem)] w-[640px] max-w-full rounded-lg shadow-lg" />
          </div>
        </div>

        <div className="flex w-60 shrink-0 flex-col gap-3 border-l border-default-200 bg-default-100 p-3">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </div>
    </>
  );
}
