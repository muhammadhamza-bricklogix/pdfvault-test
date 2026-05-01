"use client";

import type { DataTableColumn } from "@/components/ui/data-table";
import type { Document } from "@/lib/shared/types/documents.types";

import { Button } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { useDocumentsQuery } from "@/lib/client/query/queries/documents.query";
import { AddFilesIllustration } from "@/components/ui/illustrations";

import { DeleteDocumentModal } from "./delete-document-modal";
import { DocumentsTableFilters } from "./documents-table-filters";
import { RenameDocumentModal } from "./rename-document-modal";
import { renderDocumentCell } from "./render-document-cell";

const COLUMNS: DataTableColumn<Document>[] = [
  { id: "thumb", name: "", defaultWidth: 64 },
  {
    id: "filename",
    name: "Name",
    isRowHeader: true,
    allowsSorting: true,
    sortType: "string",
  },
  {
    id: "sizeBytes",
    name: "Size",
    defaultWidth: 100,
    allowsSorting: true,
    sortType: "number",
  },
  {
    id: "pageCount",
    name: "Pages",
    defaultWidth: 80,
    allowsSorting: true,
    sortType: "number",
  },
  {
    id: "updatedAt",
    name: "Updated",
    defaultWidth: 140,
    allowsSorting: true,
    sortType: "date",
  },
  {
    id: "actions",
    name: <span className="sr-only">Actions</span>,
    defaultWidth: 60,
  },
];

const EmptyDocuments = (
  <div className="flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
    <AddFilesIllustration className="size-32 text-accent" />
    <p className="text-sm font-medium">No documents yet</p>
    <p className="text-xs text-default-500">Upload a PDF to see it here.</p>
  </div>
);

const ONE_DAY_MS = 86_400_000;

export function DocumentsTable() {
  const query = useDocumentsQuery();
  const [renameTarget, setRenameTarget] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const hasActiveFilters =
    Boolean(search) || Boolean(dateFrom) || Boolean(dateTo);

  const filtered = useMemo(() => {
    if (!hasActiveFilters) return items;

    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo).getTime() + ONE_DAY_MS : Infinity;

    return items.filter((d) => {
      if (q && !d.filename.toLowerCase().includes(q)) return false;
      const t = new Date(d.updatedAt).getTime();

      if (t < from || t >= to) return false;

      return true;
    });
  }, [items, search, dateFrom, dateTo, hasActiveFilters]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
  }, []);

  const renderCell = useCallback(
    (doc: Document, columnKey: string) =>
      renderDocumentCell(doc, columnKey, {
        onDelete: setDeleteTarget,
        onRename: setRenameTarget,
      }),
    [],
  );

  const emptyContent = hasActiveFilters ? (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
      <p className="text-sm font-medium">No documents match your filters</p>
      <p className="text-xs text-default-500">
        Try adjusting your search or date range.
      </p>
      <Button size="sm" variant="ghost" onPress={clearFilters}>
        Clear filters
      </Button>
    </div>
  ) : (
    EmptyDocuments
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <DocumentsTableFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          filteredCount={filtered.length}
          search={search}
          totalCount={items.length}
          onClear={clearFilters}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onSearchChange={setSearch}
        />

        <DataTable<Document>
          ariaLabel="My documents"
          columns={COLUMNS}
          data={filtered}
          emptyContent={emptyContent}
          errorMessage={
            query.error instanceof Error ? query.error.message : undefined
          }
          getRowHref={(doc: Document) => `/pdf-editor?id=${doc.id}`}
          hasNextPage={query.hasNextPage}
          isError={query.isError}
          isFetchingNextPage={query.isFetchingNextPage}
          isLoading={query.isLoading}
          renderCell={renderCell}
          onLoadMore={() => void query.fetchNextPage()}
          onRetry={() => query.refetch()}
        />
      </div>

      <RenameDocumentModal
        document={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDocumentModal
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
