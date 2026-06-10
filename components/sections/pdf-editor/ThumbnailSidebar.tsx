"use client";

import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { usePdfEditorStore } from "@/lib/client/stores";

const DEFAULT_THUMBNAIL_ZOOM = 0.2;

export type PageListLayout = "grid" | "horizontal" | "vertical";

type ThumbnailProps = {
  displayPageNumber: number;
  dragActivatorRef?: (element: HTMLElement | null) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  draftPage?: DraftPage;
  importBytes?: ArrayBuffer;
  isActive: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  layout?: PageListLayout;
  rotation?: number;
  showPageLabel?: boolean;
  sourcePageNumber?: number;
  thumbnailZoom?: number;
  onSelect: (page: number) => void;
  onToggleSelect?: (id: string) => void;
};

function Thumbnail({
  displayPageNumber,
  dragActivatorRef,
  dragHandleProps,
  draftPage,
  importBytes,
  isActive,
  isDragging = false,
  isSelected = false,
  layout = "vertical",
  rotation = 0,
  showPageLabel = true,
  sourcePageNumber,
  thumbnailZoom = DEFAULT_THUMBNAIL_ZOOM,
  onSelect,
  onToggleSelect,
}: ThumbnailProps) {
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const isBlank = draftPage?.kind === "blank";
  const isImported = draftPage?.kind === "imported";

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || isBlank) return;

    let cancelled = false;
    let importedDoc: PDFDocumentProxy | null = null;
    let importedTask: { destroy: () => void } | null = null;

    const loadPage = async () => {
      if (isImported && importBytes && draftPage) {
        // Legacy build — see comment in pdfjs-worker.ts for why.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const task = pdfjs.getDocument({ data: importBytes.slice(0) });

        importedTask = task;
        try {
          const doc = await task.promise;

          if (cancelled) {
            doc.destroy();

            return;
          }
          importedDoc = doc;
          // Keep the document alive — pdf.js destroys pages when the doc is
          // destroyed, which leaves usePageRenderer rendering against an
          // invalidated proxy. Cleanup below disposes both on unmount.
          const p = await doc.getPage(draftPage.importPageIndex);

          if (!cancelled) setPage(p);
        } catch {
          // task was cancelled or document failed to load
        }

        return;
      }

      if (!pdfDocument || !sourcePageNumber) return;

      const p = await pdfDocument.getPage(sourcePageNumber);

      if (!cancelled) setPage(p);
    };

    void loadPage();

    return () => {
      cancelled = true;
      importedDoc?.destroy();
      importedTask?.destroy();
    };
  }, [
    draftPage,
    importBytes,
    isBlank,
    isImported,
    isVisible,
    pdfDocument,
    sourcePageNumber,
  ]);

  usePageRenderer({ canvasRef, page, zoom: thumbnailZoom });

  const highlighted = isSelected || isActive;

  const rootClass =
    layout === "grid"
      ? "flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg p-2 text-left transition-colors"
      : layout === "horizontal"
        ? "flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg p-1.5 text-left transition-colors"
        : "flex w-full flex-col items-center gap-1 rounded-lg p-2 text-left transition-colors";
  const frameClass =
    layout === "grid"
      ? "flex min-h-44 w-full items-center justify-center overflow-hidden rounded border border-default-200 bg-white shadow-sm"
      : layout === "horizontal"
        ? "flex h-20 w-full items-center justify-center overflow-hidden rounded border border-default-200 bg-white shadow-sm"
        : "flex min-h-28 w-full items-center justify-center overflow-hidden rounded border border-default-200 bg-white shadow-sm";

  return (
    <div
      ref={containerRef}
      aria-grabbed={isDragging}
      aria-label={`Page ${displayPageNumber}`}
      aria-selected={highlighted}
      className={`${rootClass} ${layout === "grid" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isDragging ? "opacity-50" : ""} ${
        highlighted
          ? "bg-accent/10 ring-2 ring-[var(--color-accent)]"
          : layout === "grid"
            ? "bg-white hover:shadow-md"
            : "hover:bg-default-100"
      }`}
      role="option"
      tabIndex={layout === "grid" ? -1 : 0}
      onClick={() => {
        if (onToggleSelect && draftPage) {
          onToggleSelect(draftPage.id);

          return;
        }

        if (layout !== "grid") onSelect(displayPageNumber);
      }}
      onKeyDown={(e) => {
        if (layout === "grid") return;

        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();

          if (onToggleSelect && draftPage) {
            onToggleSelect(draftPage.id);
          } else {
            onSelect(displayPageNumber);
          }
        }
      }}
    >
      {dragHandleProps ? (
        <span
          ref={dragActivatorRef}
          {...dragHandleProps}
          aria-label={`Drag to reorder page ${displayPageNumber}`}
          className="mb-0.5 w-full cursor-grab text-center text-[10px] leading-none text-default-400 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </span>
      ) : null}
      <div
        className={frameClass}
        style={{
          ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
          ...(draftPage?.backgroundColor
            ? { backgroundColor: draftPage.backgroundColor }
            : {}),
        }}
      >
        {isBlank ? (
          <span
            className="text-[10px]"
            style={{
              color: draftPage?.backgroundColor ? "rgba(0,0,0,0.5)" : undefined,
            }}
          >
            Blank page
          </span>
        ) : (
          <canvas
            ref={canvasRef}
            style={
              draftPage?.backgroundColor
                ? { mixBlendMode: "multiply" }
                : undefined
            }
          />
        )}
      </div>
      {showPageLabel ? (
        <span className="flex size-5 items-center justify-center rounded bg-default-200 text-[10px] font-medium text-default-600">
          {displayPageNumber}
        </span>
      ) : null}
    </div>
  );
}

type SortableThumbnailProps = ThumbnailProps & {
  dragWholeCard?: boolean;
  id: string;
  sortableDisabled: boolean;
};

function SortableThumbnail({
  dragWholeCard = false,
  id,
  sortableDisabled,
  ...thumbnailProps
}: SortableThumbnailProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled: sortableDisabled, id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (dragWholeCard && !sortableDisabled) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <Thumbnail
          {...thumbnailProps}
          isDragging={isDragging}
          onSelect={() => {}}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Thumbnail
        {...thumbnailProps}
        dragActivatorRef={sortableDisabled ? undefined : setActivatorNodeRef}
        dragHandleProps={
          sortableDisabled ? undefined : { ...listeners, ...attributes }
        }
        isDragging={isDragging}
      />
    </div>
  );
}

export type SortablePageListProps = {
  className?: string;
  dragWholeCard?: boolean;
  draftPages?: DraftPage[];
  importedPdfs?: Map<string, ArrayBuffer>;
  layout?: PageListLayout;
  onReorderPages?: (fromDisplay: number, toDisplay: number) => void;
  onSelectPage?: (page: number) => void;
  onToggleSelect?: (id: string) => void;
  pageOrder?: number[];
  selectedIds?: string[];
  selectedPage?: number | null;
  showPageLabel?: boolean;
  thumbnailZoom?: number;
};

export function SortablePageList({
  className,
  dragWholeCard = false,
  draftPages,
  importedPdfs,
  layout = "vertical",
  onReorderPages,
  onSelectPage,
  onToggleSelect,
  pageOrder: pageOrderProp,
  selectedIds = [],
  selectedPage: selectedPageProp,
  showPageLabel = true,
  thumbnailZoom,
}: SortablePageListProps) {
  const storeCurrentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const storePageOrder = usePdfEditorStore((s) => s.pageOrder);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);

  const pageOrder = pageOrderProp ?? storePageOrder;
  const currentPage = selectedPageProp ?? storeCurrentPage;
  const handleSelect = onSelectPage ?? setCurrentPage;
  const listLength = draftPages?.length ?? pageCount;

  const sortableDisabled = listLength <= 1 || !onReorderPages;

  const displayIds = useMemo(
    () =>
      draftPages
        ? draftPages.map((p) => p.id)
        : Array.from({ length: pageCount }, (_, i) => String(i + 1)),
    [draftPages, pageCount],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onReorderPages) return;

    let fromDisplay: number;
    let toDisplay: number;

    if (draftPages) {
      fromDisplay = draftPages.findIndex((p) => p.id === String(active.id)) + 1;
      toDisplay = draftPages.findIndex((p) => p.id === String(over.id)) + 1;
    } else {
      fromDisplay = Number(active.id);
      toDisplay = Number(over.id);
    }

    if (
      !Number.isFinite(fromDisplay) ||
      !Number.isFinite(toDisplay) ||
      fromDisplay < 1 ||
      toDisplay < 1 ||
      fromDisplay === toDisplay
    ) {
      return;
    }

    onReorderPages(fromDisplay, toDisplay);
  };

  const strategy =
    layout === "grid"
      ? rectSortingStrategy
      : layout === "horizontal"
        ? horizontalListSortingStrategy
        : verticalListSortingStrategy;

  const content = (
    <SortableContext items={displayIds} strategy={strategy}>
      {displayIds.map((id, index) => {
        const displayPage = draftPages ? index + 1 : Number(id);
        const draftPage = draftPages?.[index];
        const sourcePage = draftPage
          ? draftPage.kind === "source"
            ? draftPage.sourcePageIndex
            : undefined
          : (pageOrder[displayPage - 1] ?? displayPage);
        const importBytes =
          draftPage?.kind === "imported" && importedPdfs
            ? importedPdfs.get(draftPage.importKey)
            : undefined;
        const selectedSet = new Set(selectedIds);

        return (
          <SortableThumbnail
            key={id}
            displayPageNumber={displayPage}
            draftPage={draftPage}
            dragWholeCard={dragWholeCard}
            id={id}
            importBytes={importBytes}
            isActive={!draftPages && displayPage === currentPage}
            isSelected={draftPage ? selectedSet.has(draftPage.id) : false}
            layout={layout}
            rotation={draftPage?.rotation ?? 0}
            showPageLabel={showPageLabel}
            sortableDisabled={sortableDisabled}
            sourcePageNumber={sourcePage}
            thumbnailZoom={thumbnailZoom}
            onSelect={handleSelect}
            onToggleSelect={onToggleSelect}
          />
        );
      })}
    </SortableContext>
  );

  if (sortableDisabled) {
    return <div className={className}>{content}</div>;
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <div className={className}>{content}</div>
    </DndContext>
  );
}

type ThumbnailSidebarProps = {
  onReorderPages?: (fromDisplay: number, toDisplay: number) => void;
};

export function ThumbnailSidebar({ onReorderPages }: ThumbnailSidebarProps) {
  return (
    <aside
      aria-label="Page thumbnails"
      className="flex w-44 shrink-0 flex-col border-r border-default-200 bg-default-100 p-2"
      role="listbox"
    >
      <SortablePageList
        className="flex flex-col gap-1 overflow-y-auto"
        layout="vertical"
        onReorderPages={onReorderPages}
      />
    </aside>
  );
}

type ThumbnailStripProps = {
  onReorderPages?: (fromDisplay: number, toDisplay: number) => void;
};

export function ThumbnailStrip({ onReorderPages }: ThumbnailStripProps) {
  return (
    <div aria-label="Page thumbnails" className="w-full" role="listbox">
      <SortablePageList
        className="flex w-full gap-1 overflow-x-auto overflow-y-hidden px-2 py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1"
        layout="horizontal"
        onReorderPages={onReorderPages}
      />
    </div>
  );
}
