import type {
  Document,
  DocumentListParams,
  DocumentListResponse,
  DownloadResponse,
  RenameDocumentInput,
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
  if (input.id) {
    formData.append("id", input.id);
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

async function getDocument(id: string): Promise<Document> {
  const { data } = await apiClient.get<Document>(DOCUMENTS.DETAIL(id));

  return data;
}

async function getDocumentDownload(id: string): Promise<DownloadResponse> {
  const { data } = await apiClient.get<DownloadResponse>(DOCUMENTS.DOWNLOAD(id));

  return data;
}

async function renameDocument(input: RenameDocumentInput): Promise<Document> {
  const { data } = await apiClient.patch<Document>(DOCUMENTS.RENAME(input.id), {
    name: input.name,
  });

  return data;
}

async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(DOCUMENTS.DELETE(id));
}

export const documentsService = {
  uploadDocument,
  listDocuments,
  getDocument,
  getDocumentDownload,
  renameDocument,
  deleteDocument,
};
