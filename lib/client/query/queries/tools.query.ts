"use client";

import type {
  Tool,
  ToolCategory,
  ToolsListResponse,
} from "@/lib/shared/types/tools.types";

import { useQuery } from "@tanstack/react-query";

import { toolsService } from "@/lib/shared/api/services/tools.service";
import { toolKeys } from "@/lib/shared/constants/query-keys";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Catalog of every tool the backend advertises. Cached aggressively — the
 * list changes when the backend ships a release, not while the user is
 * editing a PDF.
 */
export function useToolsQuery(options?: {
  category?: ToolCategory;
  enabled?: boolean;
}) {
  return useQuery<ToolsListResponse>({
    queryKey: toolKeys.list(options?.category),
    queryFn: () => toolsService.listTools(options?.category),
    enabled: options?.enabled,
    staleTime: ONE_HOUR_MS,
  });
}

export function useSuggestedToolsQuery(options?: { enabled?: boolean }) {
  return useQuery<Tool[]>({
    queryKey: toolKeys.suggested(),
    queryFn: () => toolsService.getSuggestedTools(),
    enabled: options?.enabled,
    staleTime: ONE_HOUR_MS,
  });
}
