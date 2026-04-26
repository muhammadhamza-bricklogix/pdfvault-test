export const DOCUMENTS = {
  UPLOAD: "/documents/upload",
  LIST: "/documents",
  DETAIL: (id: string) => `/documents/${id}`,
  DOWNLOAD: (id: string) => `/documents/${id}/download`,
  RENAME: (id: string) => `/documents/${id}/rename`,
  DELETE: (id: string) => `/documents/${id}`,
} as const;
