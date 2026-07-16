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

export const auditKeys = {
  all: ["audit"] as const,
  user: (pageSize: number) => [...auditKeys.all, "user", { pageSize }] as const,
  document: (documentId: string, pageSize: number) =>
    [...auditKeys.all, "document", documentId, { pageSize }] as const,
};

export const billingKeys = {
  all: ["billing"] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  subscription: () => [...billingKeys.all, "subscription"] as const,
  invoices: () => [...billingKeys.all, "invoices"] as const,
};
