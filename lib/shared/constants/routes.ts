export const ROUTES = {
  AUTH: {
    SIGN_IN: "/sign-in",
    SIGN_UP: "/sign-up",
    SSO_CALLBACK: "/sso-callback",
  },
  PUBLIC: {
    HOME: "/",
    PRICING: "/pricing",
    ALL_TOOLS: "/all-tools",
  },
  LEGAL: {
    CONTACT: "/contact",
    COOKIES: "/cookies",
    DO_NOT_SELL: "/do-not-sell",
    PRIVACY: "/privacy",
    REFUND: "/refund",
    TERMS: "/terms-and-conditions",
  },
  APP: {
    DASHBOARD: "/dashboard",
    ACTIVITY: "/dashboard/activity",
    SETTINGS: "/dashboard/settings",
    SETTINGS_GENERAL: "/dashboard/settings/general",
    SETTINGS_ACCOUNT: "/dashboard/settings/account",
    SETTINGS_LANGUAGE: "/dashboard/settings/language",
    SETTINGS_BILLING: "/dashboard/settings/billing",
    SETTINGS_DANGER: "/dashboard/settings/danger",
  },
  TOOLS: {
    PDF_EDITOR: "/pdf-composer",
    PDF_TO_EXCEL: "/tools/pdf-to-xlsx",
    EXCEL_TO_PDF: "/tools/xlsx-to-pdf",
    DOC_TO_PDF: "/tools/docx-to-pdf",
    PDF_TO_DOC: "/tools/pdf-to-docx",
    SPLIT_PDF: "/tools/split-pdf",
    BY_SLUG: (slug: string) => `/tools/${slug}` as const,
  },
} as const;
