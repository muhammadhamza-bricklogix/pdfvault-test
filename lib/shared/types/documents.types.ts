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
  /**
   * Serialized PDF-editor overlay state from the last save (watermark/bg
   * config + per-page Fabric JSON). Null for fresh documents and for any
   * doc saved before the editorState column existed. Frontend treats null
   * as "no rehydration available — fall back to re-extracting text".
   */
  editorState?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentListResponse = Paginated<Document>;

export type DocumentListParams = {
  page: number;
  pageSize: number;
  /** Server-side filename search (case-insensitive substring). */
  nameQuery?: string;
  /** ISO-8601 start date for server-side updatedAt filtering (inclusive). */
  dateFrom?: string;
  /** ISO-8601 end date for server-side updatedAt filtering (inclusive). */
  dateTo?: string;
  /** Optional server-side sort field. */
  sortBy?: "name" | "updatedAt";
  /** Optional server-side sort direction. */
  sortOrder?: "asc" | "desc";
};

export type UploadDocumentInput = {
  file: File | Blob;
  /** When provided, replaces the file of an existing document (upsert). */
  documentId?: string;
  /** Override filename when sending a Blob without a name. */
  fileName?: string;
  /** Tracking id used to subscribe to the upload-progress SSE stream. */
  trackingId?: string;
  /**
   * Serialized editor overlay state — sent as a multipart form field and
   * persisted on the Document so a refreshed session can rehydrate the
   * Fabric scene exactly. Frontend keeps this <800 KB; the backend rejects
   * >1 MiB with a 400.
   */
  editorState?: string;
};

export type CloudProvider = "gdrive" | "onedrive";

export type UploadCloudDocumentInput = {
  accessToken: string;
  fileId: string;
  fileName: string;
  mimeType?: string;
  provider: CloudProvider;
  documentId?: string;
  trackingId?: string;
};

export type RenameDocumentInput = {
  id: string;
  filename: string;
};
