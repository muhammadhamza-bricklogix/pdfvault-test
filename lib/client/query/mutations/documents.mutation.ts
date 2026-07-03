"use client";

import type {
  Document,
  DocumentListResponse,
  RenameDocumentInput,
  UploadCloudDocumentInput,
  UploadDocumentInput,
} from "@/lib/shared/types/documents.types";
import type { UploadOptions } from "@/lib/shared/api/services/documents.service";
import type { InfiniteData } from "@tanstack/react-query";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { toast } from "@/lib/shared/utils/toast";

type ListData = InfiniteData<DocumentListResponse>;
type ListContext = {
  previousLists: [readonly unknown[], ListData | undefined][];
};

/**
 * Belt-and-braces guard: every mutating action requires the network. Even
 * if the UI button is correctly disabled by `useOnlineStatus()`, a keyboard
 * shortcut, optimistic flow, or stale-state click could still fire one of
 * these mutations. Throwing here gives the existing `onError` handlers a
 * clean message to surface and prevents a confusing low-level fetch error.
 */
function assertOnline(action: string): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(`You're offline. Reconnect to ${action}.`);
  }
}

// ---------- Upload ---------------------------------------------------------

type UploadVariables = UploadDocumentInput & {
  options?: UploadOptions;
};

/**
 * Overwrite reconciliation. An overwrite re-uploads new bytes under the SAME
 * `documentId`, so the editor navigates back to the same `?id=` it already has
 * open. The document loader's "already hydrated this id" guard
 * (`use-editor-document-loader.ts`) assumes same id ⇒ same bytes and skips the
 * re-download — leaving the stale pre-overwrite file on screen. Dropping the
 * in-memory copy here (the global store survives client-side navigation) forces
 * the loader to re-fetch the freshly uploaded bytes. No-op for new uploads
 * (`documentId` undefined) and for overwrites of a document that isn't the one
 * currently open.
 */
function dropStaleEditorCopyOnOverwrite(documentId?: string) {
  if (!documentId) return;

  const editor = usePdfEditorStore.getState();

  if (editor.currentDocumentId === documentId) {
    editor.clearFile();
  }
}

/**
 * Persists an upload to the cache. Surface-level UX (progress, success, error
 * toasts) is owned by the upload-toast controller via `useTrackedUpload`.
 * This mutation deliberately does not toast.
 */
export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<Document, Error, UploadVariables>({
    mutationFn: ({ options, ...input }) => {
      assertOnline("upload this document");

      return documentsService.uploadDocument(input, options);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.setQueryData(documentKeys.detail(data.id), data);
      dropStaleEditorCopyOnOverwrite(variables.documentId);
    },
  });
}

type UploadCloudVariables = UploadCloudDocumentInput;

export function useUploadCloudDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<Document, Error, UploadCloudVariables>({
    mutationFn: (input) => {
      assertOnline("import from cloud");

      return documentsService.uploadCloudDocument(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.setQueryData(documentKeys.detail(data.id), data);
      dropStaleEditorCopyOnOverwrite(variables.documentId);
    },
  });
}

// ---------- Rename ---------------------------------------------------------

export function useRenameDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<Document, Error, RenameDocumentInput, ListContext>({
    mutationFn: (input) => {
      assertOnline("rename");

      return documentsService.renameDocument(input);
    },
    onMutate: async ({ id, filename }) => {
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
                ? { ...doc, filename, updatedAt: new Date().toISOString() }
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
      toast.success({ title: "Renamed", description: data.filename });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

// ---------- Delete ---------------------------------------------------------

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => {
      assertOnline("delete");

      return documentsService.deleteDocument(id);
    },
    onError: (error) => {
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

export function useBulkDeleteDocumentsMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { ids: string[] }>({
    mutationFn: ({ ids }) => {
      assertOnline("delete documents");

      return documentsService.bulkDeleteDocuments(ids);
    },
    onError: (error) => {
      toast.error({ title: "Bulk delete failed", description: error.message });
    },
    onSuccess: (_data, { ids }) => {
      toast.success({ title: `${ids.length} document(s) deleted` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
