import type { FormSchema } from "@/lib/shared/types/forms.types";

import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Canonical W-9 schema. Maps the IRS AcroForm field names (extracted by
 * scripts/extract-w9-fields.mjs into schemas/w9-raw-fields.json) to
 * human labels, semantic types, sections, and conditional rules.
 *
 * IDs deliberately match the suffix of the AcroForm name (e.g. `f1_01`,
 * `c1_1`) for round-trip readability. `pdfRef` is the full nested
 * topmostSubform path the backend uses to stamp values.
 */
export const W9_SCHEMA: FormSchema = {
  id: "w-9",
  label: "Form W-9",
  pdfUrl: ROUTES.STATIC.W9_BLANK_PDF,
  pageCount: 1,
  sections: [
    {
      id: "identity",
      title: "1. Your identity",
      description: "Name and business name as shown on your tax return.",
      fields: [
        {
          id: "f1_01",
          label: "Name (as shown on your income tax return)",
          type: "text",
          required: true,
          pdfRef: "topmostSubform[0].Page1[0].f1_01[0]",
          rect: { page: 1, x: 58.6, y: 659.97, w: 517.4, h: 14 },
        },
        {
          id: "f1_02",
          label: "Business name / disregarded entity (if different)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].f1_02[0]",
          rect: { page: 1, x: 58.6, y: 635.97, w: 517.4, h: 14 },
        },
      ],
    },

    {
      id: "classification",
      title: "3. Federal tax classification",
      description: "Tick the box that matches how you are taxed.",
      fields: [
        {
          id: "c1_1",
          label: "Federal tax classification",
          type: "radio",
          required: true,
          // The radio is rendered as 7 separate AcroForm check-boxes; the
          // editor stamps the right one via the matching pdfRef suffix.
          pdfRef: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1",
          optionFields: { llc: ["f1_03"], other: ["f1_04"] },
          rect: { page: 1, x: 73, y: 553.97, w: 320, h: 60 },
          options: [
            {
              id: "individual",
              label: "Individual / sole proprietor",
              rect: { page: 1, x: 73, y: 603.72, w: 8, h: 8 },
            },
            {
              id: "c-corp",
              label: "C corporation",
              rect: { page: 1, x: 180, y: 603.72, w: 8, h: 8 },
            },
            {
              id: "s-corp",
              label: "S corporation",
              rect: { page: 1, x: 252, y: 603.72, w: 8, h: 8 },
            },
            {
              id: "partnership",
              label: "Partnership",
              rect: { page: 1, x: 324, y: 603.72, w: 8, h: 8 },
            },
            {
              id: "trust-estate",
              label: "Trust / estate",
              rect: { page: 1, x: 388.8, y: 603.72, w: 8, h: 8 },
            },
            {
              id: "llc",
              label: "LLC",
              rect: { page: 1, x: 73, y: 590.47, w: 8, h: 8 },
            },
            {
              id: "other",
              label: "Other",
              rect: { page: 1, x: 73, y: 553.97, w: 8, h: 8 },
            },
          ],
        },
        {
          id: "f1_03",
          label: "LLC tax classification (C, S, or P)",
          type: "text",
          required: true,
          pdfRef: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]",
          rect: { page: 1, x: 417.6, y: 588.97, w: 28.8, h: 11 },
          maxLength: 1,
          showIf: { c1_1: "llc" },
          helpText: "Enter C for C corp, S for S corp, or P for partnership.",
        },
        {
          id: "f1_04",
          label: "Other classification (describe)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]",
          rect: { page: 1, x: 162.4, y: 551.97, w: 284, h: 12 },
          showIf: { c1_1: "other" },
        },
        {
          id: "c1_2",
          label:
            "3b — Partnership, trust, or LLC providing W-9 to a partnership with foreign partners",
          type: "checkbox",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_2[0]",
          rect: { page: 1, x: 440.6, y: 520.97, w: 8, h: 8 },
        },
      ],
    },

    {
      id: "exemptions",
      title: "4. Exemptions (most people leave blank)",
      fields: [
        {
          id: "f1_05",
          label: "Exempt payee code (if any)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].f1_05[0]",
          rect: { page: 1, x: 543.6, y: 587.97, w: 32.4, h: 12 },
          maxLength: 2,
        },
        {
          id: "f1_06",
          label: "Exemption from FATCA reporting code (if any)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].f1_06[0]",
          rect: { page: 1, x: 500.6, y: 551.97, w: 75.4, h: 12 },
          maxLength: 4,
        },
      ],
    },

    {
      id: "address",
      title: "5 & 6. Address",
      fields: [
        {
          id: "f1_07",
          label: "Address (number, street, and apt or suite no.)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]",
          rect: { page: 1, x: 58.6, y: 491.97, w: 329.45, h: 14 },
        },
        {
          id: "f1_08",
          label: "City, state, and ZIP code",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]",
          rect: { page: 1, x: 58.6, y: 467.97, w: 329.45, h: 14 },
        },
        {
          id: "f1_09",
          label: "Requester's name and address (optional)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].f1_09[0]",
          multiline: true,
          rect: { page: 1, x: 389.8, y: 467.97, w: 186.2, h: 38 },
          // Rect is tall (multi-line block on the printed form) so the
          // height-derived sizing overshoots versus the neighbouring
          // address / name inputs. Pin the base size, in points, to match
          // them; the overlay still scales it with the page zoom.
          overlayFontSize: 10,
        },
        {
          id: "f1_10",
          label: "List account number(s) here (optional)",
          type: "text",
          required: false,
          pdfRef: "topmostSubform[0].Page1[0].f1_10[0]",
          rect: { page: 1, x: 58.6, y: 443.97, w: 517.4, h: 14 },
        },
      ],
    },

    {
      id: "tin",
      title: "Part I — Taxpayer Identification Number (TIN)",
      description:
        "Enter your SSN (individuals / most sole proprietors) OR your EIN (businesses). Use only one.",
      fields: [
        {
          id: "ssn",
          label: "Social Security Number",
          type: "ssn",
          required: false,
          // The PDF splits SSN into three segments (3-2-4 digits). Each
          // segment has its own AcroForm rect from the extraction; render
          // one input per segment so the digits land in their printed boxes.
          pdfRef: "topmostSubform[0].Page1[0].f1_11_12_13[0]",
          rect: { page: 1, x: 417.6, y: 395.97, w: 158.4, h: 24 },
          maxLength: 11,
          format: "###-##-####",
          segments: [
            {
              length: 3,
              rect: { page: 1, x: 417.6, y: 395.97, w: 43.2, h: 24 },
            },
            {
              length: 2,
              rect: { page: 1, x: 475.2, y: 395.97, w: 28.8, h: 24 },
            },
            {
              length: 4,
              rect: { page: 1, x: 518.4, y: 395.97, w: 57.6, h: 24 },
            },
          ],
        },
        {
          id: "ein",
          label: "Employer Identification Number",
          type: "ein",
          required: false,
          // EIN is split into two segments (2-7). One overlay input per box.
          pdfRef: "topmostSubform[0].Page1[0].f1_14_15[0]",
          rect: { page: 1, x: 417.6, y: 347.97, w: 144, h: 24 },
          maxLength: 10,
          format: "##-#######",
          segments: [
            {
              length: 2,
              rect: { page: 1, x: 417.6, y: 347.97, w: 28.8, h: 24 },
            },
            {
              length: 7,
              rect: { page: 1, x: 460.8, y: 347.97, w: 100.8, h: 24 },
            },
          ],
        },
      ],
    },

    {
      id: "certification",
      title: "Part II — Certification and signature",
      description:
        "Sign and date to certify your TIN is correct and that you are not subject to backup withholding.",
      fields: [
        {
          id: "signature",
          label: "Signature of U.S. person",
          type: "signature",
          required: true,
          pdfRef: "topmostSubform[0].Page1[0].signature[0]",
          // The W-9 has no AcroForm widget for the signature line; coords
          // measured from the IRS Rev March 2024 template. Signature box
          // hugs the "Signature of U.S. person" label on the left and
          // ends at the vertical separator before the printed "Date"
          // label so the sig ink can't spill into it. Width 175pt.
          // Grown DOWNWARD (y 195 → 183, h 24 → 30) so the row has more
          // room for the signature ink. h reduced from 36 → 30 to add
          // ~6 pt of clearance under the "See the instructions for Part
          // II, later." text row above (the earlier h=36 pushed the top
          // edge back into that row). Space below the printed signature
          // line is empty on the template, so extending down is safe.
          rect: { page: 1, x: 178, y: 183, w: 175, h: 30 },
        },
        {
          id: "signature_date",
          label: "Date",
          type: "date",
          required: true,
          pdfRef: "topmostSubform[0].Page1[0].signature_date[0]",
          // Date input begins immediately after the printed "Date" label
          // and fills the remaining printed date line to the right
          // margin — previously started 20pt too far right so the
          // input didn't sit on the actual date line.
          rect: { page: 1, x: 405, y: 195, w: 160, h: 24 },
        },
      ],
    },
  ],
};
