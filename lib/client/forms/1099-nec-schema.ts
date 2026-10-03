import type { FormSchema } from "@/lib/shared/types/forms.types";

import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Canonical 1099-NEC schema. Maps individual IRS Form 1099-NEC fields
 * to human labels, semantic types, sections, and exact PDF overlay coordinates.
 *
 * Each field corresponds to an individual cell on the IRS 1099-NEC form,
 * ensuring clean separation of name, street, room/suite, city, state, zip, phone, etc.
 */
export const NEC_1099_SCHEMA: FormSchema = {
  id: "1099-nec",
  label: "Form 1099-NEC",
  pdfUrl: ROUTES.STATIC.NEC_1099_BLANK_PDF,
  pageCount: 6,
  sections: [
    {
      id: "header",
      title: "Header & Status",
      description: "Calendar year and return status flags.",
      fields: [
        {
          id: "calendar_year",
          label: "For calendar year",
          type: "text",
          required: false,
          pdfRef:
            "topmostSubform[0].CopyA[0].PgHeader[0].CalendarYear[0].f1_1[0]",
          maxLength: 4,
          rect: { page: 2, x: 417.6, y: 687, w: 28.8, h: 9 },
        },
        {
          id: "additional_info",
          label: "Additional information",
          type: "text",
          required: false,
          // The IRS shades this block and leaves it blank — there is no
          // AcroForm widget anywhere inside it, so there is nothing to set
          // text into. Both stampers draw the value on instead.
          pdfRef: "",
          freeText: true,
          multiline: true,
          maxLength: 140,
          overlayFontSize: 8,
          helpText: "Optional note. Not an official IRS field.",
          rect: { page: 2, x: 295.2, y: 684, w: 100.8, h: 72 },
        },
        {
          id: "is_void",
          label: "VOID",
          type: "checkbox",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].c1_1[0]",
          rect: { page: 2, x: 187.2, y: 757.5, w: 10, h: 10 },
        },
        {
          id: "is_corrected",
          label: "CORRECTED",
          type: "checkbox",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].c1_1[1]",
          rect: { page: 2, x: 244.8, y: 757.5, w: 10, h: 10 },
        },
      ],
    },

    {
      id: "payer",
      title: "1. Payer Information",
      description: "Business or individual paying nonemployee compensation.",
      fields: [
        {
          id: "payer_name",
          label: "PAYER'S name",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_2[0]",
          multiline: true,
          // The IRS widget carries the Multiline flag, so this renders as a
          // textarea and would otherwise take the small multi-line ratio —
          // 10.8pt against the 15pt TIN box in an identically sized 24pt
          // cell below it. Pin it to sit with its neighbours.
          overlayFontSize: 13,
          rect: { page: 2, x: 52.4, y: 720, w: 241.8, h: 24 },
        },
        {
          id: "payer_street",
          label: "Street address",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_3[0]",
          rect: { page: 2, x: 52.4, y: 696, w: 155.4, h: 12 },
        },
        {
          id: "payer_suite",
          label: "Room or suite no.",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_4[0]",
          rect: { page: 2, x: 209.8, y: 696, w: 84.4, h: 12 },
        },
        {
          id: "payer_city",
          label: "City or town",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_5[0]",
          rect: { page: 2, x: 52.4, y: 672, w: 155.4, h: 12 },
        },
        {
          id: "payer_phone",
          label: "Telephone number",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_6[0]",
          rect: { page: 2, x: 209.8, y: 672, w: 84.4, h: 12 },
        },
        {
          id: "payer_state",
          label: "State or province",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_7[0]",
          maxLength: 2,
          rect: { page: 2, x: 52.4, y: 648, w: 119.4, h: 12 },
        },
        {
          id: "payer_country",
          label: "Country",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_8[0]",
          maxLength: 2,
          rect: { page: 2, x: 173.8, y: 648, w: 34, h: 12 },
        },
        {
          id: "payer_zip",
          label: "ZIP or foreign postal code",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_9[0]",
          rect: { page: 2, x: 209.8, y: 648, w: 84.4, h: 12 },
        },
        {
          id: "payer_tin",
          label: "PAYER'S TIN",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_10[0]",
          maxLength: 11,
          rect: { page: 2, x: 52.4, y: 612, w: 119.4, h: 24 },
        },
      ],
    },

    {
      id: "recipient",
      title: "2. Recipient Information",
      description: "Contractor or freelancer receiving compensation.",
      fields: [
        {
          id: "recipient_tin",
          label: "RECIPIENT'S TIN",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_11[0]",
          maxLength: 11,
          rect: { page: 2, x: 173.8, y: 612, w: 120.4, h: 24 },
        },
        {
          id: "recipient_name",
          label: "RECIPIENT'S name",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_12[0]",
          multiline: true,
          // The IRS widget carries the Multiline flag, so this renders as a
          // textarea and would otherwise take the small multi-line ratio —
          // 10.8pt against the 15pt TIN box in an identically sized 24pt
          // cell below it. Pin it to sit with its neighbours.
          overlayFontSize: 13,
          rect: { page: 2, x: 52.4, y: 576, w: 241.8, h: 24 },
        },
        {
          id: "recipient_street",
          label: "Street address",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_13[0]",
          rect: { page: 2, x: 52.4, y: 552, w: 191.4, h: 12 },
        },
        {
          id: "recipient_apt",
          label: "Apt. no.",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_14[0]",
          rect: { page: 2, x: 245.8, y: 552, w: 48.4, h: 12 },
        },
        {
          id: "recipient_city",
          label: "City or town",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_15[0]",
          rect: { page: 2, x: 52.4, y: 528, w: 241.8, h: 12 },
        },
        {
          id: "recipient_state",
          label: "State or province",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_16[0]",
          maxLength: 2,
          rect: { page: 2, x: 52.4, y: 504, w: 119.4, h: 12 },
        },
        {
          id: "recipient_country",
          label: "Country",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_17[0]",
          maxLength: 2,
          rect: { page: 2, x: 173.8, y: 504, w: 34, h: 12 },
        },
        {
          id: "recipient_zip",
          label: "ZIP or foreign postal code",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_18[0]",
          rect: { page: 2, x: 209.8, y: 504, w: 84.4, h: 12 },
        },
        {
          id: "account_number",
          label: "Account number (see instructions)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].f1_19[0]",
          maxLength: 44,
          rect: { page: 2, x: 52.4, y: 432, w: 198.6, h: 24 },
        },
        {
          id: "second_tin_notice",
          label: "2nd TIN not.",
          type: "checkbox",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].LeftCol[0].c1_2[0]",
          rect: { page: 2, x: 269.6, y: 446, w: 8, h: 8 },
        },
      ],
    },

    {
      id: "compensation",
      title: "3. Compensation & Federal Withholding",
      description: "Reportable payment amounts and taxes withheld.",
      fields: [
        {
          id: "box1_nec",
          label: "1a Nonemployee compensation ($)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_20[0]",
          rect: { page: 2, x: 309.6, y: 648, w: 185.2, h: 12 },
        },
        {
          id: "box1b_cash_tips",
          label: "1b Cash tips ($)",
          type: "text",
          required: false,
          pdfRef:
            "topmostSubform[0].CopyA[0].RightCol[0].Box1b_ReadOrder[0].f1_21[0]",
          rect: { page: 2, x: 309.6, y: 612, w: 84.4, h: 12 },
        },
        {
          id: "box1c_ttoc",
          label: "1c TTOC",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_22[0]",
          maxLength: 3,
          rect: { page: 2, x: 397.5, y: 612, w: 47.4, h: 12 },
        },
        {
          id: "box1c_ttoc_2",
          label: "1c TTOC (second cell)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_23[0]",
          maxLength: 3,
          rect: { page: 2, x: 447.9, y: 612, w: 47.4, h: 12 },
        },
        {
          id: "box1d_overtime",
          label: "1d Overtime compensation ($)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_24[0]",
          rect: { page: 2, x: 309.6, y: 576, w: 185.2, h: 12 },
        },
        {
          id: "box2_direct_sales",
          label:
            "2 Payer made direct sales totaling $5,000 or more of consumer products to recipient for resale",
          type: "checkbox",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].c1_3[0]",
          rect: { page: 2, x: 482.4, y: 558, w: 8, h: 8 },
        },
        {
          id: "box3_excess_golden",
          label: "3 Excess golden parachute payments ($)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_25[0]",
          rect: { page: 2, x: 309.6, y: 504, w: 185.2, h: 12 },
        },
        {
          id: "box4_fed_tax_withheld",
          label: "4 Federal income tax withheld ($)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_26[0]",
          rect: { page: 2, x: 309.6, y: 468, w: 185.2, h: 12 },
        },
      ],
    },

    {
      id: "state_tax",
      title: "4. State Tax Information",
      description: "State income and tax withholding details if applicable.",
      fields: [
        {
          id: "box5_state_tax_1",
          label: "5 State tax withheld (Row 1) ($)",
          type: "text",
          required: false,
          pdfRef:
            "topmostSubform[0].CopyA[0].RightCol[0].Box5_ReadOrder[0].f1_27[0]",
          rect: { page: 2, x: 309.6, y: 444, w: 84.4, h: 12 },
        },
        {
          id: "box6_state_no_1",
          label: "6 State / Payer's state no. (Row 1)",
          type: "text",
          required: false,
          pdfRef:
            "topmostSubform[0].CopyA[0].RightCol[0].Box6_ReadOrder[0].f1_29[0]",
          rect: { page: 2, x: 397, y: 444, w: 97.8, h: 12 },
        },
        {
          id: "box7_state_income_1",
          label: "7 State income (Row 1) ($)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_31[0]",
          rect: { page: 2, x: 511.2, y: 444, w: 64.8, h: 12 },
        },
        {
          id: "box5_state_tax_2",
          label: "5 State tax withheld (Row 2) ($)",
          type: "text",
          required: false,
          pdfRef:
            "topmostSubform[0].CopyA[0].RightCol[0].Box5_ReadOrder[0].f1_28[0]",
          rect: { page: 2, x: 309.6, y: 432, w: 84.4, h: 12 },
        },
        {
          id: "box6_state_no_2",
          label: "6 State / Payer's state no. (Row 2)",
          type: "text",
          required: false,
          pdfRef:
            "topmostSubform[0].CopyA[0].RightCol[0].Box6_ReadOrder[0].f1_30[0]",
          rect: { page: 2, x: 397, y: 432, w: 97.8, h: 12 },
        },
        {
          id: "box7_state_income_2",
          label: "7 State income (Row 2) ($)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].CopyA[0].RightCol[0].f1_32[0]",
          rect: { page: 2, x: 511.2, y: 432, w: 64.8, h: 12 },
        },
      ],
    },
  ],
};
