import type { DocumentListParams } from "@/lib/shared/types/documents.types";
import type { ToolCategory } from "@/lib/shared/types/tools.types";

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (params: DocumentListParams) =>
    [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

export const toolKeys = {
  all: ["tools"] as const,
  list: (category?: ToolCategory) =>
    category
      ? ([...toolKeys.all, "list", category] as const)
      : ([...toolKeys.all, "list"] as const),
  suggested: () => [...toolKeys.all, "suggested"] as const,
  detail: (id: string) => [...toolKeys.all, "detail", id] as const,
};
