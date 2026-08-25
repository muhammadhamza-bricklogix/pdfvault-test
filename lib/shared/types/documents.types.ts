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
   * Original upload filename when the source wasn't a PDF (backend
   * converted it to PDF for the editor). Null for native PDF uploads.
   * Frontend uses `originalContentType` to distinguish paid conversions
   * (paywall on Open/Download) from free native uploads (no paywall).
   */
  originalFilename?: string | null;
  /** Original upload mimetype when the source wasn't a PDF (else null).
   *  When non-null, the document is a converted PDF and the dashboard
   *  gates Open/Download on entitlement. */
  originalContentType?: string | null;
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

/**
 * True when the document originated from a conversion (X→PDF) rather
 * than a native PDF upload. Drives the dashboard Open/Download paywall
 * gate — only converted docs are paid.
 */
export function isConvertedDocument(
  doc: Pick<Document, "originalContentType"> | null | undefined,
): boolean {
  return Boolean(doc?.originalContentType);
}

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
