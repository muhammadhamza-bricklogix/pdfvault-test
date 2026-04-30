"use client";

import { Skeleton } from "@heroui/react";

/**
 * Editor placeholder shown while a document referenced by `?id=` is loading.
 * Mirrors the chrome layout so heights/positions don't shift on hydration.
 */
export function EditorLoadingShell() {
  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-2 px-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-6 rounded-md" />
        ))}
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex w-44 shrink-0 flex-col gap-3 border-r border-default-200 bg-default-100 p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-md" />
          ))}
        </div>

        <div className="flex flex-1 items-start justify-center overflow-hidden bg-default-100 p-6">
          <Skeleton className="h-[calc(100%-2rem)] w-[640px] max-w-full rounded-lg shadow-lg" />
        </div>

        <div aria-hidden className="w-44 shrink-0 bg-default-100" />
        <div className="flex w-60 shrink-0 flex-col gap-3 border-l border-default-200 bg-default-100 p-3">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </div>
    </>
  );
}
