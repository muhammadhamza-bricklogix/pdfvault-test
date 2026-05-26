/** Mirrors the Prisma `AuditAction` enum on the backend. */
export type AuditAction =
  | "DOCUMENT_CREATED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_DOWNLOADED"
  | "DOCUMENT_DELETED";

export type AuditEvent = {
  id: string;
  userId: string;
  /** Null when the document has been hard-deleted (FK was set null). */
  documentId: string | null;
  action: AuditAction;
  /** e.g. "pdf", "docx". Null for non-conversion events. */
  sourceFormat: string | null;
  targetFormat: string | null;
  byteSize: number | null;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  /** ISO timestamp serialized by the API; convert with new Date() at the edge. */
  createdAt: string;
};

export type AuditPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuditListResponse = {
  items: AuditEvent[];
  pagination: AuditPagination;
};

export type AuditListParams = {
  page?: number;
  pageSize?: number;
};
