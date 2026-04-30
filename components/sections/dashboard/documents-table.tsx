"use client";

import type { DataTableColumn } from "@/components/ui/data-table";
import type { Document } from "@/lib/shared/types/documents.types";

import { useCallback, useMemo, useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { useDocumentsQuery } from "@/lib/client/query/queries/documents.query";
import {
  AddFilesIllustration,
  FilesUploadingIllustration,
  SuccessfulUploadIllustration,
  UploadErrorIllustration,
} from "@/components/ui/illustrations";

import { DeleteDocumentModal } from "./delete-document-modal";
import { RenameDocumentModal } from "./rename-document-modal";
import { renderDocumentCell } from "./render-document-cell";

const COLUMNS: DataTableColumn<Document>[] = [
  { id: "thumb", name: "", defaultWidth: 64 },
  { id: "filename", name: "Name", isRowHeader: true },
  { id: "sizeBytes", name: "Size", defaultWidth: 100 },
  { id: "pageCount", name: "Pages", defaultWidth: 80 },
  { id: "updatedAt", name: "Updated", defaultWidth: 140 },
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

export function DocumentsTable() {
  const query = useDocumentsQuery();
  const [renameTarget, setRenameTarget] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const renderCell = useCallback(
    (doc: Document, columnKey: string) =>
      renderDocumentCell(doc, columnKey, {
        onDelete: setDeleteTarget,
        onRename: setRenameTarget,
      }),
    [],
  );

  return (
    <>
      <DataTable<Document>
        ariaLabel="My documents"
        columns={COLUMNS}
        data={items}
        emptyContent={EmptyDocuments}
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
