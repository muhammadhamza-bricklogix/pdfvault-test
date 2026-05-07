import type {
  CloudProvider,
  Document,
  DocumentListParams,
  DocumentListResponse,
  RenameDocumentInput,
  UploadCloudDocumentInput,
  UploadDocumentInput,
} from "@/lib/shared/types/documents.types";
import type { AxiosProgressEvent } from "axios";

import { apiClient } from "@/lib/config/api-client";
import { DOCUMENTS } from "@/lib/shared/constants/endpoints";

export type UploadOptions = {
  onUploadProgress?: (event: AxiosProgressEvent) => void;
  signal?: AbortSignal;
};

async function uploadDocument(
  input: UploadDocumentInput,
  options?: UploadOptions,
): Promise<Document> {
  const formData = new FormData();
  const file =
    input.file instanceof File
      ? input.file
      : new File([input.file], input.fileName ?? "document.pdf", {
          type: "application/pdf",
        });

  formData.append("file", file);
  if (input.documentId) {
    formData.append("documentId", input.documentId);
  }
  if (input.trackingId) {
    formData.append("trackingId", input.trackingId);
  }

  const { data } = await apiClient.post<Document>(DOCUMENTS.UPLOAD, formData, {
    onUploadProgress: options?.onUploadProgress,
    signal: options?.signal,
  });

  return data;
}

async function listDocuments(
  params: DocumentListParams,
): Promise<DocumentListResponse> {
  const { data } = await apiClient.get<DocumentListResponse>(DOCUMENTS.LIST, {
    params,
  });

  return data;
}

async function uploadCloudDocument(
  input: UploadCloudDocumentInput,
): Promise<Document> {
  const { data } = await apiClient.post<Document>(DOCUMENTS.UPLOAD_CLOUD, {
    accessToken: input.accessToken,
    documentId: input.documentId,
    fileId: input.fileId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    provider: input.provider satisfies CloudProvider,
    trackingId: input.trackingId,
  });

  return data;
}

async function getDocument(id: string): Promise<Document> {
  const { data } = await apiClient.get<Document>(DOCUMENTS.DETAIL(id));

  return data;
}

async function renameDocument(input: RenameDocumentInput): Promise<Document> {
  const { data } = await apiClient.patch<Document>(DOCUMENTS.RENAME(input.id), {
    filename: input.filename,
  });

  return data;
}

async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(DOCUMENTS.DELETE(id));
}

async function bulkDeleteDocuments(ids: string[]): Promise<void> {
  await apiClient.post(DOCUMENTS.BULK_DELETE, { ids });
}

export const documentsService = {
  uploadDocument,
  uploadCloudDocument,
  listDocuments,
  getDocument,
  renameDocument,
  deleteDocument,
  bulkDeleteDocuments,
};
