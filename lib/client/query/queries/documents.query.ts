"use client";

import type {
  Document,
  DocumentListResponse,
  DownloadResponse,
} from "@/lib/shared/types/documents.types";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";

export const DEFAULT_PAGE_SIZE = 20;

type UseDocumentsQueryOptions = {
  pageSize?: number;
  enabled?: boolean;
};

/** Paginated list with infinite-scroll. */
export function useDocumentsQuery(options?: UseDocumentsQueryOptions) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;

  return useInfiniteQuery<DocumentListResponse>({
    queryKey: documentKeys.list({ page: 0, pageSize }),
    queryFn: ({ pageParam = 1 }) =>
      documentsService.listDocuments({
        page: pageParam as number,
        pageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    enabled: options?.enabled,
  });
}

/** Single document metadata. */
export function useDocumentQuery(id: string | null | undefined) {
  return useQuery<Document>({
    queryKey: documentKeys.detail(id ?? ""),
    queryFn: () => documentsService.getDocument(id as string),
    enabled: Boolean(id),
  });
}

type UseDocumentDownloadQueryOptions = {
  enabled?: boolean;
};

/**
 * Presigned download URL — disabled by default. Pass `enabled: true` (or call
 * `refetch()`) only when actually needed so we don't burn quota on hover.
 */
export function useDocumentDownloadQuery(
  id: string | null | undefined,
  options?: UseDocumentDownloadQueryOptions,
) {
  return useQuery<DownloadResponse>({
    queryKey: documentKeys.download(id ?? ""),
    queryFn: () => documentsService.getDocumentDownload(id as string),
    enabled: Boolean(id) && (options?.enabled ?? false),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
