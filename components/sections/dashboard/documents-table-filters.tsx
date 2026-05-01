"use client";

import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, Label, TextField } from "@heroui/react";

type Props = {
  search: string;
  dateFrom: string;
  dateTo: string;
  totalCount: number;
  filteredCount: number;
  onSearchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
};

export function DocumentsTableFilters({
  dateFrom,
  dateTo,
  filteredCount,
  onClear,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  search,
  totalCount,
}: Props) {
  const hasActiveFilters =
    Boolean(search) || Boolean(dateFrom) || Boolean(dateTo);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-default-200 bg-default-50/50 p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
        <HugeiconsIcon
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-default-400"
          icon={Search01Icon}
          size={16}
        />
        <TextField
          aria-label="Search documents"
          value={search}
          onChange={onSearchChange}
        >
          <Label className="sr-only">Search</Label>
          <Input
            className="pl-9"
            placeholder="Search by name..."
            type="search"
          />
        </TextField>
        {search ? (
          <Button
            isIconOnly
            aria-label="Clear search"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2"
            size="sm"
            variant="ghost"
            onPress={() => onSearchChange("")}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 sm:ml-auto sm:items-end">
        <span className="text-xs text-default-500">Updated</span>
        <div className="flex items-center gap-2">
          <TextField
            aria-label="Updated from"
            value={dateFrom}
            onChange={onDateFromChange}
          >
            <Input className="w-[150px]" type="date" />
          </TextField>
          <span className="text-xs text-default-400">to</span>
          <TextField
            aria-label="Updated to"
            value={dateTo}
            onChange={onDateToChange}
          >
            <Input className="w-[150px]" type="date" />
          </TextField>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 sm:items-end">
        <span className="text-xs text-default-500">
          Showing {filteredCount} of {totalCount}
        </span>
        {hasActiveFilters ? (
          <Button size="sm" variant="ghost" onPress={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
