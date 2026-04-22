"use client";

import { Button } from "@heroui/react";

import { usePdfEditorStore } from "@/lib/client/stores";

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function EditorTopBar() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const zoom = usePdfEditorStore((s) => s.zoom);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setZoom = usePdfEditorStore((s) => s.setZoom);

  const zoomOut = () => {
    const prev = ZOOM_PRESETS.filter((z) => z < zoom).at(-1);

    if (prev !== undefined) setZoom(prev);
  };

  const zoomIn = () => {
    const next = ZOOM_PRESETS.find((z) => z > zoom);

    if (next !== undefined) setZoom(next);
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--color-background)] px-3">
      {/* File name */}
      <span className="max-w-48 truncate text-sm font-medium text-[var(--color-foreground)]">
        {file?.name ?? "PDF Editor"}
      </span>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          isDisabled={currentPage <= 1}
          size="sm"
          variant="ghost"
          onPress={() => setCurrentPage(currentPage - 1)}
        >
          ‹
        </Button>
        <span className="min-w-24 text-center text-xs text-[var(--app-muted)]">
          Page {currentPage} of {pageCount}
        </span>
        <Button
          isDisabled={currentPage >= pageCount}
          size="sm"
          variant="ghost"
          onPress={() => setCurrentPage(currentPage + 1)}
        >
          ›
        </Button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          isDisabled={zoom <= ZOOM_PRESETS[0]}
          size="sm"
          variant="ghost"
          onPress={zoomOut}
        >
          −
        </Button>
        <span className="min-w-12 text-center text-xs tabular-nums text-[var(--app-muted)]">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          isDisabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
          size="sm"
          variant="ghost"
          onPress={zoomIn}
        >
          +
        </Button>
      </div>
    </div>
  );
}
