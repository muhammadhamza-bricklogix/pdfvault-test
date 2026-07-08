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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--pv-text-muted)]">
          <HugeiconsIcon icon={Search01Icon} size={16} />
        </span>
        <input
          aria-label="Search for PDFs"
          className="h-11 w-full rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] pl-9 pr-16 text-[14px] text-[var(--pv-text-strong)] placeholder:text-[var(--pv-text-muted)] focus:border-[var(--pv-text-strong)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--pv-brand-red)]/25"
          placeholder="Search for PDFs"
          type="search"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <kbd className="pv-kbd">⌘K</kbd>
        </span>
      </div>
      <button
        className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-4 text-[14px] font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
        type="button"
        onClick={onFilters}
      >
        <HugeiconsIcon icon={Sorting01Icon} size={16} />
        Filters
      </button>
      <button
        className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-4 text-[14px] font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
        type="button"
        onClick={onSort}
      >
        <HugeiconsIcon icon={Sorting01Icon} size={16} />
        Sort By
        <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
      </button>
    </div>
  );
}
