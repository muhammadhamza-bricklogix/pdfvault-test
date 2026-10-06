"use client";

import type { Document } from "@/lib/shared/types/documents.types";
import type {
  MRT_ColumnDef,
  MRT_ColumnFiltersState,
} from "mantine-react-table";

import { Button, Input, TextField } from "@heroui/react";
import { MantineProvider } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MantineReactTable } from "mantine-react-table";

import { W9_LIBRARY_FILENAME } from "@/components/sections/forms/W9FinalizeIntercept";
import { AddFilesIllustration } from "@/components/ui/illustrations";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { useDocumentsQuery } from "@/lib/client/query/queries/documents.query";
import {
  documentMatchesTableFilters,
  formatDocumentBytes,
  formatDocumentDate,
} from "@/lib/client/utils/documents-table-display";
import { openDocumentInEditor } from "@/lib/client/utils/open-document-in-editor";
import { triggerDocumentDownload } from "@/lib/client/utils/trigger-document-download";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { BulkDeleteDocumentsModal } from "./bulk-delete-documents-modal";
import { DeleteDocumentModal } from "./delete-document-modal";
import { DocumentActionsMenu } from "./document-actions-menu";
import { DocumentThumbnail } from "./document-thumbnail";
import { RenameDocumentModal } from "./rename-document-modal";

const BULK_DOWNLOAD_DELAY_MS = 280;

const BRAND_RED: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  "#fef2f2",
  "#fde2e2",
  "#fbc6c5",
  "#f59896",
  "#ef6663",
  "#df3a38",
  "#c92a28",
  "#a4221f",
  "#7f1815",
  "#5a0e0c",
];

const DOCUMENTS_TABLE_MANTINE_THEME = {
  colors: { brand: BRAND_RED },
  primaryColor: "brand",
  primaryShade: 5,
} as const;

const EmptyDocuments = (
  <div className="flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
    <AddFilesIllustration className="size-32 text-accent" />
    <p className="text-sm font-medium">No documents yet</p>
    <p className="text-xs text-default-500">Upload a PDF to see it here.</p>
  </div>
);

export function DocumentsTable() {
  const query = useDocumentsQuery();
  const router = useRouter();
  const [renameTarget, setRenameTarget] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<Document[] | null>(
    null,
  );
  const [bulkDownloadPending, setBulkDownloadPending] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const columnFilters = useMemo<MRT_ColumnFiltersState>(() => {
    if (!dateFrom && !dateTo) return [];

    return [{ id: "updatedAt", value: [dateFrom, dateTo] }];
  }, [dateFrom, dateTo]);

  const filterParams = useMemo(
    () => ({
      dateFrom,
      dateTo,
      nameQuery: globalFilter ?? "",
    }),
    [dateFrom, dateTo, globalFilter],
  );

  const filteredCount = useMemo(
    () =>
      items.filter((d) => documentMatchesTableFilters(d, filterParams)).length,
    [items, filterParams],
  );

  const hasActiveDateFilters = Boolean(dateFrom) || Boolean(dateTo);

  const clearDateFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  const handleGlobalFilterChange = (value: string | undefined) => {
    setGlobalFilter(value ?? "");
  };

  const columns = useMemo<MRT_ColumnDef<Document>[]>(
    () => [
      {
        id: "thumb",
        accessorFn: (row) => row.id,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        enableSorting: false,
        header: "",
        maxSize: 32,
        minSize: 32,
        size: 32,
        mantineTableBodyCellProps: {
          style: { paddingLeft: 0, paddingRight: 0 },
        },
        mantineTableHeadCellProps: {
          style: { paddingLeft: 0, paddingRight: 0 },
        },
        Cell: ({ row }) => (
          <div className="flex w-full items-center justify-start">
            <DocumentThumbnail document={row.original} />
          </div>
        ),
      },
      {
        accessorKey: "filename",
        header: "Name",
        Cell: ({ row }) => (
          <button
            className="line-clamp-1 cursor-pointer text-left font-medium text-[var(--color-foreground)] underline-offset-2 hover:underline"
            type="button"
            onClick={() => {
              void openDocumentInEditor(router, row.original).catch((err) => {
                toast.error({
                  title: "Couldn't open file",
                  description: err instanceof Error ? err.message : undefined,
                });
              });
            }}
          >
            {row.original.filename}
          </button>
        ),
      },
      {
        accessorKey: "sizeBytes",
        enableGlobalFilter: false,
        header: "Size",
        Cell: ({ row }) => (
          <span className="text-sm text-default-500">
            {formatDocumentBytes(row.original.sizeBytes)}
          </span>
        ),
      },
      {
        id: "updatedAt",
        accessorFn: (row) => new Date(row.updatedAt),
        enableGlobalFilter: false,
        filterFn: (row, _columnId, filterValue: unknown) => {
          if (
            filterValue == null ||
            !Array.isArray(filterValue) ||
            filterValue.length < 2
          ) {
            return true;
          }

          const [fromYmd, toYmd] = filterValue as [string, string];

          return documentMatchesTableFilters(row.original, {
            dateFrom: typeof fromYmd === "string" ? fromYmd : "",
            dateTo: typeof toYmd === "string" ? toYmd : "",
            nameQuery: "",
          });
        },
        header: "Updated",
        sortingFn: "datetime",
        Cell: ({ row }) => (
          <span className="text-sm text-default-500">
            {formatDocumentDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        accessorFn: (row) => row.id,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        enableSorting: false,
        header: "Actions",
        size: 80,
        Cell: ({ row }) => (
          <div className="flex justify-end">
            <DocumentActionsMenu
              document={row.original}
              onDelete={() => setDeleteTarget(row.original)}
              onRename={() => setRenameTarget(row.original)}
            />
          </div>
        ),
      },
    ],
    [router],
  );

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const selectedDocuments = items.filter((doc) => rowSelection[doc.id]);
  const selectedCount = selectedDocuments.length;

  // US-03 (2026-09-18): route each selected non-W-9 doc through the editor
  // auto-export so bulk downloads carry the same overlays (drawings,
  // highlights, annotations, signatures, page numbers, watermark, bg image)
  // that single-doc downloads bake in. The cloud PDF stored per doc has
  // `stripBakedOverlaysForSave` applied on save, so streaming the cloud
  // URL returns the original / partially-edited bytes — the bug the P0
  // review flagged. Editor auto-launch (`useExportEditor` items #1-4)
  // reloads the doc, hydrates `editorState`, and produces the fully
  // baked PDF. W-9 library saves are server-finalized on save so we
  // stream those directly (skip the editor round-trip).
  const handleBulkDownload = async () => {
    if (!selectedDocuments.length) return;

    setBulkDownloadPending(true);

    try {
      // Gate paywall once for the whole batch. Entitled callers short-
      // circuit silently inside `requestPaywall`; non-entitled see the
      // paywall once, and subsequent per-doc opens benefit from the
      // now-hot entitlement cache.
      const outcome = await requestPaywall(undefined, { hidePreview: true });

      if (outcome !== "success") return;

      let openedTabs = 0;

      for (const doc of selectedDocuments) {
        const isW9 =
          doc.filename.toLowerCase() === W9_LIBRARY_FILENAME.toLowerCase();

        if (isW9) {
          await triggerDocumentDownload(doc);
        } else {
          const query = new URLSearchParams({ id: doc.id, export: "pdf" });
          const win = window.open(
            `${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`,
            "_blank",
            "noopener",
          );

          if (win) openedTabs += 1;
        }

        await new Promise((r) => setTimeout(r, BULK_DOWNLOAD_DELAY_MS));
      }

      const nonW9Count = selectedDocuments.filter(
        (d) => d.filename.toLowerCase() !== W9_LIBRARY_FILENAME.toLowerCase(),
      ).length;
      const someBlocked = openedTabs < nonW9Count;

      toast.success({
        title: "Downloads started",
        description: someBlocked
          ? `${selectedDocuments.length} file(s). Some tabs were blocked by your browser — allow popups from this site and retry, or use the row Download button.`
          : `${selectedDocuments.length} file(s).`,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
      toast.error({
        title: "Download failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBulkDownloadPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-default-200/80 bg-default-50/40 p-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-default-500">
              Showing {filteredCount} of {items.length}
            </span>
            {hasActiveDateFilters ? (
              <Button size="sm" variant="ghost" onPress={clearDateFilters}>
                Clear dates
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-1 sm:items-end">
            <span className="text-xs font-medium text-default-500">
              Updated
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <TextField
                aria-label="Updated from"
                value={dateFrom}
                onChange={(v) => setDateFrom(typeof v === "string" ? v : "")}
              >
                <Input
                  className="h-9 w-full min-w-0 sm:w-[138px]"
                  type="date"
                />
              </TextField>
              <span className="text-xs text-default-400">to</span>
              <TextField
                aria-label="Updated to"
                value={dateTo}
                onChange={(v) => setDateTo(typeof v === "string" ? v : "")}
              >
                <Input
                  className="h-9 w-full min-w-0 sm:w-[138px]"
                  type="date"
                />
              </TextField>
            </div>
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 dark:border-[var(--accent)]/40 dark:bg-[var(--accent)]/15">
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              {selectedCount} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                isDisabled={bulkDownloadPending}
                size="sm"
                variant="ghost"
                onPress={() => {
                  setRowSelection({});
                }}
              >
                Clear selection
              </Button>
              <Button
                isDisabled={bulkDownloadPending}
                size="sm"
                variant="secondary"
                onPress={() => void handleBulkDownload()}
              >
                {bulkDownloadPending ? "Downloading…" : "Download"}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onPress={() => setBulkDeleteTargets([...selectedDocuments])}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}

        <MantineProvider
          withGlobalStyles
          withNormalizeCSS
          theme={DOCUMENTS_TABLE_MANTINE_THEME}
        >
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[640px] px-4 sm:min-w-0 sm:px-0">
              <MantineReactTable
                enableGlobalFilter
                enableRowSelection
                columns={columns}
                data={items}
                displayColumnDefOptions={{
                  "mrt-row-select": {
                    maxSize: 24,
                    minSize: 24,
                    size: 24,
                    mantineTableBodyCellProps: {
                      style: { paddingLeft: 4, paddingRight: 0 },
                    },
                    mantineTableHeadCellProps: {
                      style: { paddingLeft: 4, paddingRight: 0 },
                    },
                  },
                }}
                enableColumnActions={false}
                enableColumnFilters={false}
                enableDensityToggle={false}
                enableFullScreenToggle={false}
                enableHiding={false}
                getRowId={(row) => row.id}
                initialState={{
                  columnPinning: {
                    left: ["mrt-row-select", "thumb", "filename"],
                  },
                  showGlobalFilter: true,
                }}
                mantineSearchTextInputProps={{
                  placeholder: "Search by name...",
                  size: "sm",
                }}
                mantineSelectAllCheckboxProps={{
                  size: "xs",
                }}
                mantineSelectCheckboxProps={{
                  size: "xs",
                }}
                mantineTableBodyCellProps={{
                  style: {
                    fontSize: "13px",
                    paddingBottom: "8px",
                    paddingTop: "8px",
                  },
                }}
                mantineTableBodyRowProps={{
                  style: { minHeight: "44px" },
                }}
                mantineTableHeadCellProps={{
                  style: {
                    fontSize: "12px",
                    paddingBottom: "8px",
                    paddingTop: "8px",
                  },
                }}
                positionGlobalFilter="left"
                positionToolbarAlertBanner="none"
                renderEmptyRowsFallback={() => EmptyDocuments}
                state={{
                  columnFilters,
                  globalFilter,
                  isLoading: query.isLoading,
                  rowSelection,
                  showAlertBanner: query.isError,
                  showProgressBars: query.isFetchingNextPage,
                }}
                onGlobalFilterChange={handleGlobalFilterChange}
                onRowSelectionChange={setRowSelection}
              />
            </div>
          </div>
        </MantineProvider>

        {query.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              isDisabled={query.isFetchingNextPage}
              variant="ghost"
              onPress={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      <RenameDocumentModal
        document={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDocumentModal
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <BulkDeleteDocumentsModal
        documents={bulkDeleteTargets}
        onClose={() => setBulkDeleteTargets(null)}
        onSuccess={() => {
          setRowSelection({});
        }}
      />
    </>
  );
}
