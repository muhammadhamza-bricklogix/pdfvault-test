"use client";

import type { ChangeEvent } from "react";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface PvSearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Kept in the prop interface even though nothing renders them yet — the
   * dashboard's Filters + Sort By UI was hidden 2026-08-25 pending a real
   * filtering/sorting spec (currently client-side only, no backend params
   * to wire against). Callers can keep passing these; they become live
   * again when we un-hide the buttons below.
   */
  onFilters?: () => void;
  onSort?: () => void;
}

/**
 * Search row above the file table. Controlled `value` lets the parent drive
 * client-side filtering against the rows.
 *
 * There used to be a decorative `⌘K` chip here, but it never triggered a
 * global search shortcut (out of scope for that pass) and it hardcoded the
 * Mac symbol even for Windows users — a UX review flagged it as a promise
 * the UI didn't keep. Removed rather than wired up, since a real global
 * shortcut is still out of scope; re-add a chip only alongside an actual
 * `Ctrl+K` / `⌘K` keydown handler.
 */
export function PvSearchToolbar({ value, onChange }: PvSearchToolbarProps) {
  return (
    <div className="flex flex-row items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--pv-text-muted)]">
          <HugeiconsIcon icon={Search01Icon} size={16} />
        </span>
        <input
          aria-label="Search for PDFs"
          className="h-11 w-full rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] pl-9 pr-3 text-[14px] text-[var(--pv-text-strong)] placeholder:text-[var(--pv-text-muted)] focus:border-[var(--pv-text-strong)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--pv-brand-red)]/25"
          placeholder="Search for PDFs"
          type="search"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
        />
      </div>
    </div>
  );
}
