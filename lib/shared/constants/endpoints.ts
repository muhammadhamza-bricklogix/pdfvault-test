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
  VERSIONS: (id: string) => `/documents/${id}/versions`,
  RESTORE_VERSION: (id: string, versionId: string) =>
    `/documents/${id}/restore/${versionId}`,
} as const;

export const CONVERSION = {
  CONVERT: "/conversion",
} as const;

export const BILLING = {
  PLANS: "/billing/plans",
  SUBSCRIPTION: "/billing/subscription",
  CHECKOUT_INTENT: "/billing/checkout-intent",
  INVOICES: "/billing/invoices",
} as const;

export const TOOLS = {
  LIST: "/tools",
  SUGGESTED: "/tools/suggested",
  DETAIL: (id: string) => `/tools/${id}`,
} as const;

export const PDF_TOOLS = {
  COMPRESS: "/pdf-tools/compress",
  ENCRYPT: "/pdf-tools/encrypt",
  DECRYPT: "/pdf-tools/decrypt",
  FLATTEN: "/pdf-tools/flatten",
  EXTRACT_IMAGES: "/pdf-tools/extract-images",
} as const;

export const AUDIT = {
  LIST: "/audit",
  BY_DOCUMENT: (id: string) => `/audit/documents/${id}`,
} as const;

export const USERS = {
  PROFILE: "/users/profile",
  /** Idempotent provisioning — call once after sign-in completes. */
  ME: "/users/me",
  /** Pino audit hook — call right before `useClerk().signOut()`. */
  SIGN_OUT: "/users/sign-out",
} as const;
