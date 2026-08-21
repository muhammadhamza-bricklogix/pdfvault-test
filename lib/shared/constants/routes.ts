export const ROUTES = {
  AUTH: {
    SIGN_IN: "/sign-in",
    SIGN_UP: "/sign-up",
    SSO_CALLBACK: "/sso-callback",
    FORGOT_PASSWORD: "/forgot-password",
  },
  PUBLIC: {
    HOME: "/",
    PRICING: "/pricing",
    ALL_TOOLS: "/all-tools",
    ABOUT: "/about",
  },
  LEGAL: {
    CONTACT: "/contact",
    COOKIES: "/cookies",
    DO_NOT_SELL: "/do-not-sell",
    PRIVACY: "/privacy",
    REFUND: "/refund",
    SUBSCRIPTION_TERMS: "/subscription-terms",
    TERMS: "/terms-and-conditions",
  },
  APP: {
    DASHBOARD: "/dashboard",
    ACTIVITY: "/dashboard/activity",
    FORMS: "/dashboard/forms",
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
  FORMS: {
    W9: "/forms/w-9",
    W9_FORM: "/w9-form",
    W9_EDIT: "/forms/w-9/edit",
    // Short marketing URL for the W-9 editor. Matches the competitor
    // slug pattern (pdfguru.com/forms/w-9-form) so users searching for
    // "w-9 form" land here. Old `/w-9` requests 308-redirect to this
    // path via next.config.mjs so pre-rename bookmarks still resolve.
    W9_SHORT: "/w-9-form",
    W4: "/forms/w-4",
    NEC_1099: "/forms/1099-nec",
    W7: "/forms/w-7",
  },
  STATIC: {
    W9_BLANK_PDF: "/static/forms/fw9.pdf",
  },
} as const;
