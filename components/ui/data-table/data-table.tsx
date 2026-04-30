"use client";

import type { ReactNode } from "react";
import type { SortDescriptor } from "react-aria-components";

import { Button, EmptyState, Spinner, Table } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type DataTableColumn<TData> = {
  /** Unique column id. Also used as the `columnKey` passed to `renderCell`. */
  id: Extract<keyof TData, string> | (string & {});
  name: ReactNode;
  /** Show the React Aria sort indicator and emit sort change events. */
  allowsSorting?: boolean;
  /** Marks the row-header column for accessibility. */
  isRowHeader?: boolean;
  /** Default width for the column (px or CSS value). */
  defaultWidth?: number | string;
  minWidth?: number;
  /** Hint that lets the built-in client-side sorter pick the right comparator. */
  sortType?: "auto" | "date" | "number" | "string";
  /** Override the value used for client-side sort/search. */
  getSortValue?: (item: TData) => unknown;
};

export type DataTableMode = "client" | "server";

export type DataTableProps<TData> = {
  columns: DataTableColumn<TData>[];
  data: TData[] | undefined;
  renderCell: (item: TData, columnKey: string) => ReactNode;

  /** Used for `key`. Defaults to `item.id` when present. */
  getRowKey?: (item: TData) => string;
  /** Optional href per row (renders as a link row). */
  getRowHref?: (item: TData) => string | undefined;

  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyContent?: ReactNode;

  ariaLabel?: string;

  // ---- Client-mode features (ignored when mode = "server") ----------------
  mode?: DataTableMode;
  searchQuery?: string;
  searchKeys?: (keyof TData)[];

  enablePagination?: boolean;
  defaultPageSize?: number;

  // ---- Infinite scroll (alternative to pagination) ------------------------
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;

  className?: string;
  scrollClassName?: string;
};

const DEFAULT_EMPTY: ReactNode = (
  <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-2 py-10 text-center">
    <span className="text-sm text-default-500">No results found.</span>
  </EmptyState>
);

export function DataTable<TData extends object>({
  ariaLabel = "Data table",
  columns,
  data,
  defaultPageSize = 20,
  emptyContent = DEFAULT_EMPTY,
  enablePagination = false,
  errorMessage,
  getRowHref,
  getRowKey,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  mode = "client",
  onLoadMore,
  onRetry,
  renderCell,
  scrollClassName,
  searchKeys,
  searchQuery,
}: DataTableProps<TData>) {
  const router = useRouter();
  const [sortDescriptor, setSortDescriptor] = useState<
    SortDescriptor | undefined
  >(undefined);
  const [page, setPage] = useState(1);

  const rows = data ?? [];

  // Client-side filter
  const filtered = useMemo(() => {
    if (mode !== "client" || !searchQuery || !searchKeys?.length) return rows;
    const q = searchQuery.toLowerCase();

    return rows.filter((item) =>
      searchKeys.some((key) =>
        String((item as Record<string, unknown>)[key as string] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, searchQuery, searchKeys, mode]);

  // Client-side sort
  const sorted = useMemo(() => {
    if (mode !== "client" || !sortDescriptor?.column) return filtered;
    const col = columns.find((c) => c.id === sortDescriptor.column);

    if (!col) return filtered;

    const sortType = col.sortType ?? "auto";
    const getValue =
      col.getSortValue ??
      ((item: TData) => (item as Record<string, unknown>)[col.id as string]);
    const next = [...filtered];

    next.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      let cmp = 0;

      if (
        sortType === "number" ||
        (sortType === "auto" && typeof av === "number")
      ) {
        cmp = Number(av) - Number(bv);
      } else if (sortType === "date") {
        cmp =
          new Date(av as string).getTime() - new Date(bv as string).getTime();
      } else {
        cmp = String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
      }

      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });

    return next;
  }, [filtered, sortDescriptor, mode, columns]);

  // Client-side pagination (skipped when infinite scroll is on)
  const isInfinite = Boolean(onLoadMore);
  const totalPages =
    enablePagination && !isInfinite
      ? Math.max(1, Math.ceil(sorted.length / defaultPageSize))
      : 1;
  const paginated = useMemo(() => {
    if (!enablePagination || isInfinite) return sorted;
    const start = (page - 1) * defaultPageSize;

    return sorted.slice(start, start + defaultPageSize);
  }, [sorted, page, defaultPageSize, enablePagination, isInfinite]);

  const resolveKey = useCallback(
    (item: TData): string => {
      if (getRowKey) return getRowKey(item);
      const id = (item as { id?: unknown }).id;

      return typeof id === "string" || typeof id === "number" ? String(id) : "";
    },
    [getRowKey],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-default-200 bg-default-100 p-6 text-center">
        <p className="text-sm font-medium">Something went wrong.</p>
        {errorMessage ? (
          <p className="max-w-md text-xs text-default-500">
            {errorMessage}
          </p>
        ) : null}
        {onRetry ? <Button onPress={onRetry}>Retry</Button> : null}
      </div>
    );
  }

  return (
    <Table aria-label={ariaLabel} variant="secondary">
      <Table.ScrollContainer className={scrollClassName ?? "max-h-[70vh]"}>
        <Table.Content
          aria-label={ariaLabel}
          sortDescriptor={sortDescriptor}
          onSortChange={mode === "client" ? setSortDescriptor : undefined}
        >
          <Table.Header columns={columns}>
            {(column) => (
              <Table.Column
                allowsSorting={column.allowsSorting}
                defaultWidth={column.defaultWidth as number | undefined}
                id={column.id}
                isRowHeader={column.isRowHeader}
                minWidth={column.minWidth}
              >
                {column.name}
              </Table.Column>
            )}
          </Table.Header>
          <Table.Body
            items={paginated}
            renderEmptyState={() => <>{emptyContent}</>}
          >
            {(item) => {
              const key = resolveKey(item);
              const href = getRowHref?.(item);

              return (
                <Table.Row
                  key={key}
                  className={href ? "cursor-pointer" : ""}
                  id={key}
                  onAction={href ? () => router.push(href) : undefined}
                >
                  <Table.Collection items={columns}>
                    {(column) => (
                      <Table.Cell>
                        {renderCell(item, String(column.id))}
                      </Table.Cell>
                    )}
                  </Table.Collection>
                </Table.Row>
              );
            }}
          </Table.Body>
          {isInfinite ? (
            <Table.LoadMore
              isLoading={Boolean(isFetchingNextPage)}
              onLoadMore={() => {
                if (hasNextPage && !isFetchingNextPage) onLoadMore?.();
              }}
            >
              <Table.LoadMoreContent>
                <Spinner size="sm" />
              </Table.LoadMoreContent>
            </Table.LoadMore>
          ) : null}
        </Table.Content>
      </Table.ScrollContainer>
      {enablePagination && !isInfinite && totalPages > 1 ? (
        <Table.Footer>
          <ClientPagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </Table.Footer>
      ) : null}
    </Table>
  );
}

function ClientPagination({
  onChange,
  page,
  totalPages,
}: {
  onChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-2 text-sm">
      <Button
        isDisabled={page === 1}
        size="sm"
        variant="ghost"
        onPress={() => onChange(Math.max(1, page - 1))}
      >
        Previous
      </Button>
      <span className="text-default-500">
        Page {page} of {totalPages}
      </span>
      <Button
        isDisabled={page === totalPages}
        size="sm"
        variant="ghost"
        onPress={() => onChange(Math.min(totalPages, page + 1))}
      >
        Next
      </Button>
    </div>
  );
}
