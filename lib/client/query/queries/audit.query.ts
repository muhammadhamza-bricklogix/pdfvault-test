"use client";

import type { AuditListResponse } from "@/lib/shared/types/audit.types";

import { useInfiniteQuery } from "@tanstack/react-query";

import { auditService } from "@/lib/shared/api/services/audit.service";
import { auditKeys } from "@/lib/shared/constants/query-keys";

export const DEFAULT_AUDIT_PAGE_SIZE = 25;

type UseAuditQueryOptions = {
  pageSize?: number;
  enabled?: boolean;
};

/**
 * Infinite-scroll feed of the current user's audit events. Mirrors the
 * `useDocumentsQuery` pattern so the UI can reuse the same load-more
 * triggers and skeleton components.
 */
export function useAuditQuery(options?: UseAuditQueryOptions) {
  const pageSize = options?.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE;

  return useInfiniteQuery<AuditListResponse>({
    queryKey: auditKeys.user(pageSize),
    queryFn: ({ pageParam = 1 }) =>
      auditService.listAuditEvents({ page: pageParam as number, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;

      return page < totalPages ? page + 1 : undefined;
    },
    enabled: options?.enabled,
  });
}

/** Per-document history; powers the drawer opened from a document row. */
export function useDocumentAuditQuery(
  documentId: string | null | undefined,
  options?: UseAuditQueryOptions,
) {
  const pageSize = options?.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE;

  return useInfiniteQuery<AuditListResponse>({
    queryKey: auditKeys.document(documentId ?? "", pageSize),
    queryFn: ({ pageParam = 1 }) =>
      auditService.listDocumentAuditEvents(documentId as string, {
        page: pageParam as number,
        pageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;

      return page < totalPages ? page + 1 : undefined;
    },
    enabled: Boolean(documentId) && options?.enabled !== false,
  });
}
