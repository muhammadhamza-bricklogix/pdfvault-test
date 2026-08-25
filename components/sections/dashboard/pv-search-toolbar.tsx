"use client";

import type { ChangeEvent } from "react";

import {
  ArrowDown01Icon,
  Search01Icon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface PvSearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  onFilters?: () => void;
  onSort?: () => void;
}

/**
 * Search + Filters + Sort By row above the file table. Controlled `value`
 * lets the parent drive client-side filtering against mock rows. `⌘K` chip
 * is decorative — global search shortcut is out of scope for this pass.
 */
export function PvSearchToolbar({
  value,
  onChange,
  onFilters,
  onSort,
}: PvSearchToolbarProps) {
  return (
    <div className="flex flex-row items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--pv-text-muted)]">
          <HugeiconsIcon icon={Search01Icon} size={16} />
        </span>
        <input
          aria-label="Search for PDFs"
          // Keyboard chip stays on sm+ (`pr-16`); mobile drops the trailing
          // gutter (`pr-3`) since the ⌘K hint is hidden below and the row
          // needs every horizontal pixel to fit Filters + Sort By.
          className="h-11 w-full rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] pl-9 pr-3 text-[14px] text-[var(--pv-text-strong)] placeholder:text-[var(--pv-text-muted)] focus:border-[var(--pv-text-strong)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--pv-brand-red)]/25 sm:pr-16"
          placeholder="Search for PDFs"
          type="search"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 hidden items-center sm:flex">
          <kbd className="pv-kbd">⌘K</kbd>
        </span>
      </div>
      <button
        aria-label="Filters"
        // Icon-only on mobile (`px-3`, label hidden) so the search bar
        // keeps most of the row width; label + wider padding re-appear on
        // sm+ where there's room.
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-3 text-[14px] font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] sm:px-4"
        type="button"
        onClick={onFilters}
      >
        <HugeiconsIcon icon={Sorting01Icon} size={16} />
        <span className="hidden sm:inline">Filters</span>
      </button>
      <button
        aria-label="Sort By"
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-3 text-[14px] font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] sm:px-4"
        type="button"
        onClick={onSort}
      >
        <HugeiconsIcon icon={Sorting01Icon} size={16} />
        <span className="hidden sm:inline">Sort By</span>
        <HugeiconsIcon
          className="hidden sm:inline"
          icon={ArrowDown01Icon}
          size={14}
        />
      </button>
    </div>
  );
}
