"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { usePdfSearchStore } from "@/lib/client/stores/pdf-search-store";

type Props = {
  goToNext: () => void;
  goToPrev: () => void;
};

export function PdfSearchBar({ goToNext, goToPrev }: Props) {
  const {
    isOpen,
    close,
    query,
    setQuery,
    matches,
    currentMatchIndex,
    isIndexing,
    indexedPageCount,
  } = usePdfSearchStore();

  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search opens.
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard: Escape closes, Enter navigates.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();

        return;
      }

      const active = document.activeElement;
      const inInput =
        active === inputRef.current ||
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA";

      if (!inInput) return;

      if (e.key === "Enter") {
        e.preventDefault();

        if (e.shiftKey) {
          goToPrev();
        } else {
          goToNext();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close, goToNext, goToPrev]);

  const totalMatches = matches.length;
  const displayIndex = totalMatches > 0 ? currentMatchIndex + 1 : 0;

  const indexProgress =
    isIndexing && pageCount > 0
      ? Math.round((indexedPageCount / pageCount) * 100)
      : null;

  const noResults =
    query.trim().length > 0 && !isIndexing && totalMatches === 0;

  return (
    /* Slide-in bar — always in the DOM but hidden when closed so the
       transition plays correctly. The outer div is a non-capturing overlay
       that lets clicks through when closed (`pointer-events-none`). */
    <div
      aria-hidden={!isOpen}
      className={`absolute inset-x-0 top-0 z-50 flex justify-end px-4 pt-2 transition-all duration-200 ${
        isOpen
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <div
        className="flex w-full max-w-[480px] items-center gap-2 rounded-xl border border-default-200 bg-white px-3 py-2 shadow-lg ring-1 ring-default-100"
        role="search"
      >
        {/* Search icon */}
        <HugeiconsIcon
          className="shrink-0 text-default-400"
          icon={Search01Icon}
          size={16}
        />

        {/* Input */}
        <input
          ref={inputRef}
          aria-label="Search PDF"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-foreground)] placeholder:text-default-400 focus:outline-none"
          placeholder="Search in PDF…"
          spellCheck={false}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Status: loading indicator or match count */}
        {indexProgress !== null ? (
          <span className="shrink-0 whitespace-nowrap text-[12px] text-default-400">
            {indexProgress}%
          </span>
        ) : query.trim() ? (
          <span
            className={`shrink-0 whitespace-nowrap text-[12px] font-medium ${
              noResults ? "text-red-500" : "text-default-500"
            }`}
          >
            {noResults ? "No results" : `${displayIndex} / ${totalMatches}`}
          </span>
        ) : null}

        {/* Prev / Next */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            aria-label="Previous match"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-default-500 transition-colors hover:bg-default-100 hover:text-default-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={totalMatches === 0}
            type="button"
            onClick={goToPrev}
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
          </button>
          <button
            aria-label="Next match"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-default-500 transition-colors hover:bg-default-100 hover:text-default-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={totalMatches === 0}
            type="button"
            onClick={goToNext}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          </button>
        </div>

        {/* Divider */}
        <span aria-hidden className="h-4 w-px shrink-0 bg-default-200" />

        {/* Close */}
        <button
          aria-label="Close search"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-default-100 hover:text-default-700"
          type="button"
          onClick={close}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
        </button>
      </div>
    </div>
  );
}
