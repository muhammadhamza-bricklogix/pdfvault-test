"use client";

import type {
  Document,
  DocumentListResponse,
} from "@/lib/shared/types/documents.types";

import { useAuth } from "@clerk/nextjs";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";
import {
  type CachedDocument,
  readCachedDocumentList,
  replaceDocumentList,
  upsertCachedDocument,
} from "@/lib/client/offline";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";

export const DEFAULT_PAGE_SIZE = 20;

export type DocumentListFilters = {
  nameQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "name" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

type UseDocumentsQueryOptions = DocumentListFilters & {
  pageSize?: number;
  enabled?: boolean;
};

/**
 * Hydrates a cached entry into the on-the-wire shape consumers expect.
 * `url` is intentionally an empty string — presigned URLs only live ~15
 * minutes, so persisting them is pointless. Downstream consumers
 * (DocumentThumbnail, dashboard tile click) fall through to a graceful
 * empty/icon state when offline; once back online the next fetch
 * overwrites these placeholders with real URLs.
 */
function rehydrate(doc: CachedDocument): Document {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cachedAt: _cachedAt, ...rest } = doc;

  return { ...rest, url: "" };
}

/** Paginated list with infinite-scroll. Network-first with IDB fallback. */
export function useDocumentsQuery(options?: UseDocumentsQueryOptions) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const { userId } = useAuth();
  const isOnline = useOnlineStatus();

  const filters: DocumentListFilters = {
    dateFrom: options?.dateFrom,
    dateTo: options?.dateTo,
    nameQuery: options?.nameQuery,
    sortBy: options?.sortBy,
    sortOrder: options?.sortOrder,
  };

  return useInfiniteQuery<DocumentListResponse>({
    queryKey: documentKeys.list({ page: 0, pageSize, ...filters }),
    queryFn: async ({ pageParam = 1 }) => {
      const page = pageParam as number;

      // Offline: serve cached snapshot as a single page. We don't try to
      // re-paginate cached entries — caller sees the full library in one
      // shot, which is fine for typical libraries (≤ a few hundred docs).
      if (!isOnline) {
        if (page !== 1 || !userId) {
          return {
            items: [],
            pagination: {
              page,
              pageSize,
              total: 0,
              totalPages: 1,
            },
          };
        }
        const cached = await readCachedDocumentList(userId);

        return {
          items: cached.map(rehydrate),
          pagination: {
            page: 1,
            pageSize,
            total: cached.length,
            totalPages: 1,
          },
        };
      }

      // Online: fetch + write through. On page 1 we use a full snapshot
      // overwrite (removes deleted docs from cache and prunes their cached
      // bytes); on subsequent pages we just upsert.
      try {
        const response = await documentsService.listDocuments({
          page,
          pageSize,
          ...filters,
        });

        if (userId) {
          if (page === 1) {
            await replaceDocumentList(userId, response.items);
          } else {
            await Promise.all(
              response.items.map((doc) => upsertCachedDocument(userId, doc)),
            );
          }
        }

        return response;
      } catch (err) {
        // Network failed while reported online — fall back to cache so
        // the user still sees their library instead of an empty state.
        if (userId && page === 1) {
          const cached = await readCachedDocumentList(userId);

          if (cached.length > 0) {
            return {
              items: cached.map(rehydrate),
              pagination: {
                page: 1,
                pageSize,
                total: cached.length,
                totalPages: 1,
              },
            };
          }
        }

        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;

      return page < totalPages ? page + 1 : undefined;
    },
    enabled: options?.enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/** Single document metadata (includes a fresh presigned `url`). */
export function useDocumentQuery(id: string | null | undefined) {
  return useQuery<Document>({
    queryKey: documentKeys.detail(id ?? ""),
    queryFn: () => documentsService.getDocument(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
