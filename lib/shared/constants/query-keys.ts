import type { DocumentListParams } from "@/lib/shared/types/documents.types";

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (params: DocumentListParams) =>
    [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  downloads: () => [...documentKeys.all, "download"] as const,
  download: (id: string) => [...documentKeys.downloads(), id] as const,
};
