export const DOCUMENTS = {
  UPLOAD: "/documents/upload",
  UPLOAD_CLOUD: "/documents/upload/cloud",
  UPLOAD_PROGRESS: (trackingId: string) =>
    `/documents/upload-progress/${trackingId}`,
  LIST: "/documents",
  DETAIL: (id: string) => `/documents/${id}`,
  RENAME: (id: string) => `/documents/${id}/rename`,
  DELETE: (id: string) => `/documents/${id}`,
} as const;
