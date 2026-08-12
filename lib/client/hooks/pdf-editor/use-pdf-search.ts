"use client";

import { useCallback, useEffect } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { usePdfEditorStore } from "@/lib/client/stores";
import {
  usePdfSearchStore,
  type SearchMatch,
  type SearchPageData,
} from "@/lib/client/stores/pdf-search-store";

function findAllMatches(
  query: string,
  textIndex: Map<number, SearchPageData>,
  totalPages: number,
): SearchMatch[] {
  if (!query.trim()) return [];

  const needle = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const pageData = textIndex.get(page);

    if (!pageData) continue;

    // Build a flat page-level string, tracking where each item starts.
    let pageText = "";
    const itemOffsets: number[] = [];

    for (const item of pageData.items) {
      itemOffsets.push(pageText.length);
      pageText += item.str;
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
        const itemEnd = itemStart + pageData.items[i].str.length;

        if (itemEnd <= idx) continue;
        if (itemStart >= matchEnd) break;

        spans.push({
          itemIndex: i,
          charStart: Math.max(0, idx - itemStart),
          charEnd: Math.min(pageData.items[i].str.length, matchEnd - itemStart),
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

  // Re-search (debounced) whenever query or index changes.
  // Each effect run captures current query/textIndex; the previous timer
  // is always cancelled before the next fires so no stale closure executes.
  useEffect(() => {
    if (!isOpen) return;

    const t = setTimeout(() => {
      setMatches(findAllMatches(query, textIndex, pageCount));
    }, 250);

    return () => clearTimeout(t);
  }, [query, textIndex, isOpen, pageCount, setMatches]);

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
