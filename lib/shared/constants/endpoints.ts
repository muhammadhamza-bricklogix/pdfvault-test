export const DOCUMENTS = {
  UPLOAD: "/documents/upload",
  UPLOAD_CLOUD: "/documents/upload/cloud",
  UPLOAD_PROGRESS: (trackingId: string) =>
    `/documents/upload-progress/${trackingId}`,
  LIST: "/documents",
  DETAIL: (id: string) => `/documents/${id}`,
  RENAME: (id: string) => `/documents/${id}/rename`,
  DELETE: (id: string) => `/documents/${id}`,
  BULK_DELETE: "/documents/bulk-delete",
} as const;

export const CONVERSION = {
  CONVERT: "/conversion",
} as const;

export const TOOLS = {
  LIST: "/tools",
  SUGGESTED: "/tools/suggested",
  DETAIL: (id: string) => `/tools/${id}`,
} as const;

export const AUDIT = {
  LIST: "/audit",
  BY_DOCUMENT: (id: string) => `/audit/documents/${id}`,
} as const;

export const FORMS = {
  // Backend starts a session at the template path, not /form-sessions.
  START: (slug: string) => `/form-templates/${slug}/start`,
  DETAIL: (id: string) => `/form-sessions/${id}`,
  PATCH: (id: string) => `/form-sessions/${id}`,
  SIGNATURE: (id: string) => `/form-sessions/${id}/signature`,
  FINALIZE: (id: string) => `/form-sessions/${id}/finalize`,
} as const;
