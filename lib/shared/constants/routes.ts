export const ROUTES = {
  AUTH: {
    SIGN_IN: "/sign-in",
    SIGN_UP: "/sign-up",
    SSO_CALLBACK: "/sso-callback",
  },
  PUBLIC: {
    HOME: "/",
  },
  TOOLS: {
    PDF_TO_EXCEL: "/tools/pdf-to-excel",
    EXCEL_TO_PDF: "/tools/excel-to-pdf",
    DOC_TO_PDF: "/tools/doc-to-pdf",
    PDF_TO_DOC: "/tools/pdf-to-doc",
  },
} as const;
