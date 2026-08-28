import { ROUTES } from "@/lib/shared/constants/routes";

export const PDF_TOOLS_HUB = `${ROUTES.PUBLIC.HOME}#pdf-tools`;

export type FooterNavLink = {
  href: string;
  label: string;
};

export type FooterProductSubsection = {
  links: FooterNavLink[];
  title: string;
};

export type FooterAsideColumnIcon = "help" | "account";

export type FooterColumn = {
  asideIcon: FooterAsideColumnIcon;
  links: FooterNavLink[];
  title: string;
};

export const FOOTER_PRODUCT_COLUMN_TITLE = "Product";

export const FOOTER_EDIT_PDF_SUBSECTION_TITLE = "Edit PDF";

export const FOOTER_PRODUCT_SUBSECTIONS: FooterProductSubsection[] = [
  {
    links: [
      { href: ROUTES.TOOLS.PDF_EDITOR, label: "Edit PDF" },
      { href: ROUTES.TOOLS.PDF_EDITOR, label: "Sign PDF" },
      { href: ROUTES.TOOLS.SPLIT_PDF, label: "Split PDF" },
      { href: ROUTES.TOOLS.PDF_EDITOR, label: "Add image to PDF" },
      { href: ROUTES.TOOLS.PDF_EDITOR, label: "Delete pages" },
    ],
    title: FOOTER_EDIT_PDF_SUBSECTION_TITLE,
  },
  {
    links: [
      { href: ROUTES.TOOLS.PDF_TO_DOC, label: "PDF to Word" },
      // Hidden 2026-08-28 — PPTX + Excel conversions parked pending
      // future work. Do not remove; re-enable when pipelines are ready.
      // { href: PDF_TOOLS_HUB, label: "PDF to PPTX" },
      // { href: ROUTES.TOOLS.PDF_TO_EXCEL, label: "PDF to Excel" },
      { href: PDF_TOOLS_HUB, label: "PDF to JPG" },
      { href: PDF_TOOLS_HUB, label: "PDF to PNG" },
      { href: PDF_TOOLS_HUB, label: "View all" },
    ],
    title: "Convert from PDF",
  },
  {
    links: [
      { href: ROUTES.TOOLS.DOC_TO_PDF, label: "Word to PDF" },
      // Hidden 2026-08-28 — see note above.
      // { href: PDF_TOOLS_HUB, label: "PPTX to PDF" },
      // { href: ROUTES.TOOLS.EXCEL_TO_PDF, label: "Excel to PDF" },
      { href: PDF_TOOLS_HUB, label: "JPG to PDF" },
      { href: PDF_TOOLS_HUB, label: "PNG to PDF" },
      { href: PDF_TOOLS_HUB, label: "View all" },
    ],
    title: "Convert to PDF",
  },
  // {
  //   links: [
  //     { href: PDF_TOOLS_HUB, label: "W-9" },
  //     { href: PDF_TOOLS_HUB, label: "DS-11" },
  //     { href: PDF_TOOLS_HUB, label: "1099-MISC" },
  //     { href: PDF_TOOLS_HUB, label: "View all forms" },
  //   ],
  //   title: "Forms",
  // },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    asideIcon: "help",
    links: [
      { href: ROUTES.LEGAL.CONTACT, label: "Contact us" },
      { href: `${ROUTES.PUBLIC.HOME}#faq`, label: "FAQ" },
      { href: ROUTES.PUBLIC.PRICING, label: "Pricing" },
    ],
    title: "Help",
  },
  {
    asideIcon: "account",
    links: [
      { href: ROUTES.AUTH.SIGN_IN, label: "Sign In" },
      { href: ROUTES.AUTH.SIGN_UP, label: "Register" },
      { href: ROUTES.LEGAL.CONTACT, label: "Unsubscribe" },
    ],
    title: "Account",
  },
];

export const FOOTER_COMPANY_ENTITY = "FLUTTWINGS INVESTMENTS LIMITED";

export const FOOTER_COMPANY_ADDRESS_PLACEHOLDER = "Nicosia, Cyprus";

export const FOOTER_BRAND_NAME = "pdfvault.ai";

export const FOOTER_PUBLIC_DOMAIN = "pdfvault.ai";

/** Single primary copyright line for the marketing footer (no inline policy links). */
export function formatFooterCopyrightLine(year: number): string {
  return `© ${year}. FLUTTWINGS INVESTMENTS LIMITED. All rights reserved.`;
}

export const FOOTER_LEGAL_STRIP_LINKS: FooterNavLink[] = [
  { href: ROUTES.LEGAL.PRIVACY, label: "Privacy Policy" },
  { href: ROUTES.LEGAL.TERMS, label: "Terms and Conditions" },
  { href: ROUTES.LEGAL.COOKIES, label: "Cookie Policy" },
];

/** Centered row directly under the © line on the marketing footer. */
export const FOOTER_POST_COPYRIGHT_NAV_LINKS: FooterNavLink[] = [
  { href: ROUTES.LEGAL.PRIVACY, label: "Privacy Policy" },
  { href: ROUTES.LEGAL.TERMS, label: "Terms of Use" },
  { href: ROUTES.LEGAL.COOKIES, label: "Cookie Policy" },
  { href: ROUTES.LEGAL.REFUND, label: "Subscription Policy" },
];

export const FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINE_1 = `${FOOTER_BRAND_NAME} is an independent service and is not affiliated with, endorsed by, or approved by any governmental authority, agency, or public institution of any kind, including but not limited to the Internal Revenue Service (IRS), the Social Security Administration (SSA), or U.S. Citizenship and Immigration Services (USCIS).`;

export const FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINE_2 = `${FOOTER_BRAND_NAME} is also not associated with, connected to, or endorsed by any other editors or brands.`;
