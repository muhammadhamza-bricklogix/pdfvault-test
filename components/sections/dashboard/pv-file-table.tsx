"use client";

import type { PvFileRow, PvFileType } from "./pv-mock-my-pdfs";

import {
  ArrowDown01Icon,
  Delete02Icon,
  Download01Icon,
  Edit02Icon,
  Time04Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

interface PvFileTableProps {
  rows: readonly PvFileRow[];
  isLoading?: boolean;
  onOpen?: (row: PvFileRow) => void;
  onDownload?: (row: PvFileRow) => void;
  onRename?: (row: PvFileRow) => void;
  onHistory?: (row: PvFileRow) => void;
  onDelete?: (row: PvFileRow) => void;
  /** Called when the user hits "Delete selected" in the bulk-action bar.
   *  Receives the ids of every selected row. Parent owns the confirm
   *  modal + mutation call so the table stays presentational. */
  onBulkDelete?: (rows: readonly PvFileRow[]) => void;
}

type SortKey = "name" | "uploadedBy" | "date" | "size";
type SortDir = "asc" | "desc" | null;

const TYPE_COLOR: Record<PvFileType, string> = {
  PDF: "var(--pv-file-pdf)",
  DOC: "var(--pv-file-doc)",
  DOCX: "var(--pv-file-doc)",
  PPTX: "var(--pv-file-ppt)",
  XLS: "var(--pv-file-xls)",
  XLSX: "var(--pv-file-xls)",
};

function TypeBadge({ type }: { type: PvFileType }) {
  return (
    <span
      className="inline-flex h-6 min-w-[36px] items-center justify-center rounded-[5px] px-1.5 text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: TYPE_COLOR[type] }}
    >
      {type}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onCycle,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onCycle: (key: SortKey) => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--pv-text-body)] transition-colors hover:text-[var(--pv-text-strong)]"
      type="button"
      onClick={() => onCycle(sortKey)}
    >
      {label}
      <HugeiconsIcon
        className={`transition-transform ${
          active && dir === "asc" ? "rotate-180" : ""
        } ${active ? "text-[var(--pv-text-strong)]" : "text-[var(--pv-text-muted)]"}`}
        icon={ArrowDown01Icon}
        size={12}
      />
    </button>
  );
}

function useSortedRows(rows: readonly PvFileRow[]) {
  const [key, setKey] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<SortDir>(null);

  const cycle = (nextKey: SortKey) => {
    if (key !== nextKey) {
      setKey(nextKey);
      setDir("desc");

      return;
    }
    if (dir === "desc") {
      setDir("asc");

      return;
    }
    if (dir === "asc") {
      setKey(null);
      setDir(null);
    }
  };

  const sorted = (() => {
    if (!key || !dir) return rows;
    const sortedRows = [...rows].sort((a, b) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);

      return av < bv ? -1 : av > bv ? 1 : 0;
    });

    return dir === "asc" ? sortedRows : sortedRows.reverse();
  })();

  return { sorted, key, dir, cycle };
}

function getSortValue(row: PvFileRow, key: SortKey): string | number {
  if (key === "name") return row.name.toLowerCase();
  if (key === "uploadedBy") return row.uploadedByName.toLowerCase();
  if (key === "date") return new Date(row.doc.createdAt).getTime();

  return row.doc.sizeBytes;
}

interface RowActionsProps {
  row: PvFileRow;
  onDownload?: (row: PvFileRow) => void;
  onRename?: (row: PvFileRow) => void;
  onHistory?: (row: PvFileRow) => void;
  onDelete?: (row: PvFileRow) => void;
}

function RowActions({
  row,
  onDownload,
  onRename,
  onHistory,
  onDelete,
}: RowActionsProps) {
  const actions: {
    label: string;
    icon: typeof Download01Icon;
    handler?: () => void;
    danger?: boolean;
  }[] = [
    {
      label: "Download",
      icon: Download01Icon,
      handler: () => onDownload?.(row),
    },
    { label: "Rename", icon: Edit02Icon, handler: () => onRename?.(row) },
    { label: "History", icon: Time04Icon, handler: () => onHistory?.(row) },
    {
      label: "Delete",
      icon: Delete02Icon,
      handler: () => onDelete?.(row),
      danger: true,
    },
  ];

  return (
    <div className="flex items-center justify-end gap-1">
      {actions.map(({ label, icon, handler, danger }) => (
        <button
          key={label}
          aria-label={`${label} ${row.name}`}
          className={`flex size-8 items-center justify-center rounded-md text-[var(--pv-text-muted)] transition-colors hover:bg-[var(--pv-nav-active)] hover:text-[var(--pv-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] ${
            danger ? "hover:!text-[var(--pv-file-pdf)]" : ""
          }`}
          type="button"
          onClick={handler}
        >
          <HugeiconsIcon icon={icon} size={16} />
        </button>
      ))}
    </div>
  );
}

export function PvFileTable({
  rows,
  isLoading,
  onOpen,
  onDownload,
  onRename,
  onHistory,
  onDelete,
  onBulkDelete,
}: PvFileTableProps) {
  const { sorted, key, dir, cycle } = useSortedRows(rows);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const selectedRows = sorted.filter((r) => selected.has(r.id));
  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedRows.length === 0) return;
    onBulkDelete(selectedRows);
  };
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(sorted.map((r) => r.id)));
  };
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {selectedRows.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-fill-subtle)] px-4 py-2">
          <span className="text-[13px] font-medium text-[var(--pv-text-strong)]">
            {selectedRows.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full px-3 py-1 text-[13px] font-medium text-[var(--pv-text-body)] transition-colors hover:bg-white"
              type="button"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
            {onBulkDelete ? (
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[var(--pv-file-pdf)] px-3 py-1 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                type="button"
                onClick={handleBulkDelete}
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                Delete selected
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-[16px] border border-[var(--pv-hairline)]">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--pv-hairline)] bg-[var(--pv-fill-subtle)]">
              <th className="w-10 px-4 py-3" scope="col">
                <input
                  aria-label="Select all files"
                  checked={allSelected}
                  className="size-4 accent-[var(--pv-brand-red)]"
                  type="checkbox"
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-3" scope="col">
                <SortHeader
                  active={key === "name"}
                  dir={dir}
                  label="File Name"
                  sortKey="name"
                  onCycle={cycle}
                />
              </th>
              <th className="px-3 py-3" scope="col">
                <SortHeader
                  active={key === "uploadedBy"}
                  dir={dir}
                  label="Uploaded By"
                  sortKey="uploadedBy"
                  onCycle={cycle}
                />
              </th>
              <th className="px-3 py-3" scope="col">
                <SortHeader
                  active={key === "date"}
                  dir={dir}
                  label="Upload Date"
                  sortKey="date"
                  onCycle={cycle}
                />
              </th>
              <th className="px-3 py-3" scope="col">
                <SortHeader
                  active={key === "size"}
                  dir={dir}
                  label="File Size"
                  sortKey="size"
                  onCycle={cycle}
                />
              </th>
              <th
                className="px-4 py-3 text-right text-[13px] font-medium text-[var(--pv-text-body)]"
                scope="col"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isChecked = selected.has(row.id);
              const openable = Boolean(onOpen);
              // `role="link"` + keyboard handlers on the cell make the whole
              // row body (name + uploader + date + size) a valid open target
              // without swallowing the checkbox or action-icon clicks.
              const openTd = openable
                ? {
                    className: "px-3 py-3 align-middle cursor-pointer",
                    onClick: () => onOpen?.(row),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen?.(row);
                      }
                    },
                    role: "link",
                    tabIndex: 0,
                  }
                : { className: "px-3 py-3 align-middle" };

              return (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--pv-hairline)] transition-colors last:border-b-0 hover:bg-[var(--pv-fill-subtle)] ${
                    isChecked ? "bg-[var(--pv-nav-active)]/60" : ""
                  }`}
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      aria-label={`Select ${row.name}`}
                      checked={isChecked}
                      className="size-4 accent-[var(--pv-brand-red)]"
                      type="checkbox"
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  <td
                    {...openTd}
                    aria-label={openable ? `Open ${row.name}` : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <TypeBadge type={row.type} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[var(--pv-text-strong)]">
                          {row.name}
                        </p>
                        <p className="text-[12px] text-[var(--pv-text-muted)]">
                          {row.displaySize}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td {...openTd}>
                    <div className="flex items-center gap-3">
                      {row.uploadedByAvatar ? (
                        // Dynamic Clerk profile URL — <img> is intentional.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover"
                          loading="lazy"
                          src={row.uploadedByAvatar}
                        />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--pv-tile)] text-[var(--pv-text-body)]">
                          <HugeiconsIcon icon={UserCircleIcon} size={20} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[var(--pv-text-strong)]">
                          {row.uploadedByName}
                        </p>
                        <p className="truncate text-[12px] text-[var(--pv-text-muted)]">
                          {row.uploadedByEmail}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    {...openTd}
                    className={`${openTd.className} text-[13px] text-[var(--pv-text-body)]`}
                  >
                    {row.uploadDate}
                  </td>
                  <td
                    {...openTd}
                    className={`${openTd.className} text-[13px] text-[var(--pv-text-body)]`}
                  >
                    {row.fileSize}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <RowActions
                      row={row}
                      onDelete={onDelete}
                      onDownload={onDownload}
                      onHistory={onHistory}
                      onRename={onRename}
                    />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && !isLoading ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-[13px] text-[var(--pv-text-muted)]"
                  colSpan={6}
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <p>No files match your search.</p>
                    <a
                      className="pv-btn-primary inline-flex px-5 py-1.5 text-[13px]"
                      href="/pdf-composer"
                    >
                      Upload a PDF
                    </a>
                  </div>
                </td>
              </tr>
            ) : null}
            {isLoading && sorted.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-[13px] text-[var(--pv-text-muted)]"
                  colSpan={6}
                >
                  Loading your files…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
