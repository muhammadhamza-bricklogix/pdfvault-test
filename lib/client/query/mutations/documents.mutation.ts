"use client";

import type {
  Document,
  DocumentListResponse,
  RenameDocumentInput,
  UploadDocumentInput,
} from "@/lib/shared/types/documents.types";
import type { UploadOptions } from "@/lib/shared/api/services/documents.service";
import type { InfiniteData } from "@tanstack/react-query";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { toast } from "@/lib/shared/utils/toast";

type ListData = InfiniteData<DocumentListResponse>;
type ListContext = {
  previousLists: [readonly unknown[], ListData | undefined][];
};

// ---------- Upload ---------------------------------------------------------

type UploadVariables = UploadDocumentInput & {
  options?: UploadOptions;
};

export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<Document, Error, UploadVariables>({
    mutationFn: ({ options, ...input }) =>
      documentsService.uploadDocument(input, options),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.setQueryData(documentKeys.detail(data.id), data);
      toast.success({
        title: variables.id ? "Document saved" : "Document uploaded",
        description: data.name,
      });
    },
    onError: (error) => {
      toast.error({
        title: "Upload failed",
        description: error.message,
      });
    },
  });
}

// ---------- Rename ---------------------------------------------------------

export function useRenameDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<Document, Error, RenameDocumentInput, ListContext>({
    mutationFn: (input) => documentsService.renameDocument(input),
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previousLists = queryClient.getQueriesData<ListData>({
        queryKey: documentKeys.lists(),
      });

      previousLists.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData<ListData>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((doc) =>
              doc.id === id
                ? { ...doc, name, updatedAt: new Date().toISOString() }
                : doc,
            ),
          })),
        });
      });

      return { previousLists };
    },
    onError: (error, _vars, context) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error({ title: "Rename failed", description: error.message });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(documentKeys.detail(data.id), data);
      toast.success({ title: "Renamed", description: data.name });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

// ---------- Delete ---------------------------------------------------------

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }, ListContext>({
    mutationFn: ({ id }) => documentsService.deleteDocument(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previousLists = queryClient.getQueriesData<ListData>({
        queryKey: documentKeys.lists(),
      });

      previousLists.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData<ListData>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((doc) => doc.id !== id),
            total: Math.max(0, page.total - 1),
          })),
        });
      });

      return { previousLists };
    },
    onError: (error, _vars, context) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error({ title: "Delete failed", description: error.message });
    },
    onSuccess: () => {
      toast.success({ title: "Document deleted" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
