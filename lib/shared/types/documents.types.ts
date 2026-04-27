import type { Paginated } from "@/lib/shared/types/api.types";

export type DocumentStatus = "READY" | "PROCESSING" | "DELETED";

export type Document = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus | string;
  pageCount: number | null;
  version: number;
  /** Presigned S3 URL — valid for ~15 minutes. */
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentListResponse = Paginated<Document>;

export type DocumentListParams = {
  page: number;
  pageSize: number;
};

export type UploadDocumentInput = {
  file: File | Blob;
  /** When provided, replaces the file of an existing document (upsert). */
  documentId?: string;
  /** Override filename when sending a Blob without a name. */
  fileName?: string;
};

export type RenameDocumentInput = {
  id: string;
  filename: string;
};
