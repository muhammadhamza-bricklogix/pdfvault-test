"use client";

import { useCallback, useEffect, useRef } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { usePdfEditorStore } from "@/lib/client/stores";
import {
  usePdfSearchStore,
  type SearchMatch,
  type SearchPageData,
} from "@/lib/client/stores/pdf-search-store";

type OcclusionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FabricJsonRect = Record<string, unknown> & {
  type?: string;
  editorType?: string;
};

/**
 * Parse whiteout + redaction rectangles out of a page's serialized Fabric
 * JSON. Returns bounding boxes in Fabric base coordinates (zoom=1, top-left
 * origin), the same space `viewport.convertToViewportPoint(scale=1)`
 * returns, so text-item bboxes can be compared directly against them.
 *
 * Assumes axis-aligned rects (angle=0); the whiteout + redact tools in
 * `use-shape-tool.ts` create rects at angle 0 and the editor never rotates
 * them.
 */
function occlusionRectsFromJson(json: string | undefined): OcclusionRect[] {
  if (!json) return [];

  let parsed: { objects?: FabricJsonRect[] };

  try {
    parsed = JSON.parse(json) as { objects?: FabricJsonRect[] };
  } catch {
    return [];
  }

  const rects: OcclusionRect[] = [];
  const objects = parsed.objects ?? [];

  for (const o of objects) {
    const type = (o.type as string | undefined)?.toLowerCase();
    const editorType = o.editorType as string | undefined;

    if (type !== "rect") continue;
    if (editorType !== "whiteout" && editorType !== "redaction") continue;

    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    const width = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const height = Number(o.height ?? 0) * Number(o.scaleY ?? 1);

    if (width > 0 && height > 0) {
      rects.push({ height, left, top, width });
    }
  }

  return rects;
}

/**
 * Returns true if the text-item bbox is fully contained inside any of the
 * occlusion rects. Partial coverage (text peeks past a rect edge) returns
 * false, so visibly-readable text stays searchable per the row-21 spec.
 */
function itemFullyCovered(
  bbox: OcclusionRect,
  rects: OcclusionRect[],
): boolean {
  if (rects.length === 0) return false;
  const right = bbox.left + bbox.width;
  const bottom = bbox.top + bbox.height;

  for (const r of rects) {
    if (
      bbox.left >= r.left &&
      bbox.top >= r.top &&
      right <= r.left + r.width &&
      bottom <= r.top + r.height
    ) {
      return true;
    }
  }

  return false;
}

function itemBbox(
  item: SearchPageData["items"][number],
  pageHeight: number,
): OcclusionRect | null {
  const transform = item.transform;

  if (!Array.isArray(transform) || transform.length < 6) return null;
  const tx = Number(transform[4]);
  const ty = Number(transform[5]);

  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

  // At viewport scale=1, convertToViewportPoint(tx, ty) → (tx, pageHeight - ty).
  const vpLeft = tx;
  const vpBaseline = pageHeight - ty;
  const height = item.height > 0 ? item.height : 1;
  const width = item.width > 0 ? item.width : 1;

  return { height, left: vpLeft, top: vpBaseline - height, width };
}

function findAllMatches(
  query: string,
  textIndex: Map<number, SearchPageData>,
  totalPages: number,
  pageOrder: number[],
  fabricJsonByPage: Map<number, string>,
): SearchMatch[] {
  if (!query.trim()) return [];

  const needle = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const pageData = textIndex.get(page);

    if (!pageData) continue;

    const sourcePage =
      pageOrder.length > 0 ? (pageOrder[page - 1] ?? page) : page;
    const occlusion = occlusionRectsFromJson(fabricJsonByPage.get(sourcePage));
    const hasOcclusion = occlusion.length > 0;

    // Build a flat page-level string, tracking where each item starts.
    // Items fully covered by whiteout/redaction contribute an EMPTY string
    // so matches cannot land inside them, but their index stays in place so
    // `SearchHighlightLayer`'s `span.itemIndex` indexing is unaffected.
    let pageText = "";
    const itemOffsets: number[] = [];
    const itemLens: number[] = [];

    for (const item of pageData.items) {
      itemOffsets.push(pageText.length);
      let covered = false;

      if (hasOcclusion) {
        const bbox = itemBbox(item, pageData.pageHeight);

        if (bbox && itemFullyCovered(bbox, occlusion)) covered = true;
      }

      const str = covered ? "" : item.str;

      itemLens.push(str.length);
      pageText += str;
    }

    const lowerText = pageText.toLowerCase();
    let pos = 0;

    while (pos < lowerText.length) {
      const idx = lowerText.indexOf(needle, pos);

      if (idx === -1) break;

      const matchEnd = idx + needle.length;
      const spans: SearchMatch["spans"] = [];

      for (let i = 0; i < pageData.items.length; i++) {
        const itemStart = itemOffsets[i];
        const itemEnd = itemStart + itemLens[i];

        if (itemEnd <= idx) continue;
        if (itemStart >= matchEnd) break;
        if (itemLens[i] === 0) continue;

        spans.push({
          itemIndex: i,
          charStart: Math.max(0, idx - itemStart),
          charEnd: Math.min(itemLens[i], matchEnd - itemStart),
        });
      }

      if (spans.length) results.push({ displayPage: page, spans });
      pos = idx + 1;
    }
  }

  return results;
}

/**
 * PDF-wide text search. Call once in PdfEditorShell; share navigation
 * callbacks (goToNext / goToPrev) as props to PdfSearchBar. Store state
 * (isOpen, query, matches, …) is in usePdfSearchStore so any component
 * can read it without prop drilling.
 */
export function usePdfSearch() {
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const pageOrder = usePdfEditorStore((s) => s.pageOrder);
  const fabricJsonByPage = usePdfEditorStore((s) => s.fabricJsonByPage);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);

  const {
    isOpen,
    open,
    close,
    query,
    setQuery,
    matches,
    currentMatchIndex,
    setMatches,
    setCurrentMatchIndex,
    isIndexing,
    setIsIndexing,
    indexedPageCount,
    setIndexedPageCount,
    textIndex,
    setPageData,
    resetIndex,
  } = usePdfSearchStore();

  // Re-search (debounced) whenever query, index, or occlusion rects change.
  // Each effect run captures current query/textIndex; the previous timer
  // is always cancelled before the next fires so no stale closure executes.
  const navigatedQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const t = setTimeout(() => {
      const found = findAllMatches(
        query,
        textIndex,
        pageCount,
        pageOrder,
        fabricJsonByPage,
      );

      setMatches(found);
      // A new query jumps to its first result; index growth while
      // indexing doesn't.
      if (found.length > 0 && navigatedQueryRef.current !== query) {
        navigatedQueryRef.current = query;
        setCurrentPage(found[0].displayPage);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [
    query,
    textIndex,
    isOpen,
    pageCount,
    pageOrder,
    fabricJsonByPage,
    setMatches,
    setCurrentPage,
  ]);

  // Build text index lazily when the search panel opens.
  useEffect(() => {
    if (!isOpen || !pdfDocument) return;

    let cancelled = false;

    const buildIndex = async () => {
      await loadPdfJs(); // ensure polyfills are installed before worker calls
      setIsIndexing(true);
      setIndexedPageCount(0);

      for (let displayPage = 1; displayPage <= pageCount; displayPage++) {
        if (cancelled) return;

        const sourcePage =
          pageOrder.length > 0
            ? (pageOrder[displayPage - 1] ?? displayPage)
            : displayPage;

        try {
          const page = await pdfDocument.getPage(sourcePage);
          const viewport = page.getViewport({ scale: 1.0 });
          const content = await page.getTextContent();

          if (cancelled) return;

          type RawTextItem = {
            str: string;
            transform: ArrayLike<number>;
            width: number;
            height: number;
          };
          const items = (
            content.items.filter((item) => "str" in item) as RawTextItem[]
          )
            .filter((item) => item.str.trim().length > 0)
            .map((item) => ({
              str: item.str,
              transform: Array.from(item.transform) as number[],
              width: item.width,
              height: item.height,
            }));

          setPageData(displayPage, { items, pageHeight: viewport.height });
        } catch {
          // getTextContent failed — older iOS Safari WebKit may throw here.
          // Skip this page; search still works for all other pages.
        }

        setIndexedPageCount(displayPage);
      }

      if (!cancelled) setIsIndexing(false);
    };

    void buildIndex();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    pdfDocument,
    pageCount,
    pageOrder,
    setIsIndexing,
    setIndexedPageCount,
    setPageData,
  ]);

  // Reset index whenever the document changes (new file, save swap, etc.).
  useEffect(() => {
    resetIndex();
  }, [pdfDocument, resetIndex]);

  const navigateToMatch = useCallback(
    (idx: number) => {
      const match = matches[idx];

      if (!match) return;
      setCurrentMatchIndex(idx);
      setCurrentPage(match.displayPage);
    },
    [matches, setCurrentMatchIndex, setCurrentPage],
  );

  const goToNext = useCallback(() => {
    if (!matches.length) return;
    navigateToMatch((currentMatchIndex + 1) % matches.length);
  }, [matches, currentMatchIndex, navigateToMatch]);

  const goToPrev = useCallback(() => {
    if (!matches.length) return;
    navigateToMatch((currentMatchIndex - 1 + matches.length) % matches.length);
  }, [matches, currentMatchIndex, navigateToMatch]);

  return {
    isOpen,
    open,
    close,
    query,
    setQuery,
    matches,
    currentMatchIndex,
    totalMatches: matches.length,
    isIndexing,
    indexedPageCount,
    goToNext,
    goToPrev,
  };
}
