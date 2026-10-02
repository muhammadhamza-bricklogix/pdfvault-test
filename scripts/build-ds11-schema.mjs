#!/usr/bin/env node
/**
 * Generates lib/client/forms/ds-11-schema.ts from schemas/ds11-raw-fields.json.
 *
 * Only labels, ids, sections and conditional rules are authored here — every
 * rect, maxLength and multiline flag is read back out of the PDF so the
 * overlay can never drift from the real widget geometry. Re-run after
 * replacing public/static/forms/ds11.pdf:
 *
 *   node scripts/extract-ds11-fields.mjs
 *   node scripts/build-ds11-schema.mjs
 *
 * Option ids are the AcroForm export values verbatim ("Book", "M", "Yes"), so
 * the client, the preview stamper and the backend filler all agree without a
 * translation table in between.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_PATH = path.join(ROOT, "schemas/ds11-raw-fields.json");
const OUT_PATH = path.join(ROOT, "lib/client/forms/ds-11-schema.ts");

const YES_NO = [
  { id: "Yes", label: "Yes" },
  { id: "No", label: "No" },
];

const M_F = [
  { id: "M", label: "M" },
  { id: "F", label: "F" },
];

const DOCUMENT_STATUS = [
  { id: "Submitting", label: "Submitting with application" },
  { id: "Stolen", label: "Stolen" },
  { id: "Lost", label: "Lost" },
  { id: "Possession", label: "In my possession (if expired)" },
];

const SECTIONS = [
  {
    id: "document",
    title: "Document Selection",
    description: "Which passport product you are paying for.",
    fields: [
      {
        id: "doc_type",
        label: "Select document(s) for which you are submitting fees",
        pdf: "Selection",
        type: "radio",
        required: true,
        options: [
          { id: "Book", label: "U.S. Passport Book" },
          { id: "Card", label: "U.S. Passport Card" },
          { id: "Both", label: "Both" },
        ],
        helpText:
          "The passport card is not valid for international air travel.",
      },
      {
        id: "book_size",
        label: "Book size",
        pdf: "Regular or Large Book",
        type: "radio",
        options: [
          { id: "Regular", label: "Regular Book (Standard)" },
          { id: "Large", label: "Large Book (Non-Standard)" },
        ],
        helpText:
          "The large book is for frequent international travelers who need more visa pages.",
      },
    ],
  },
  {
    id: "applicant",
    title: "1-7. Your Details",
    description: "Name, date and place of birth, and identifying numbers.",
    fields: [
      {
        id: "last_name",
        label: "1. Last Name",
        pdf: "Applicant Last Name",
        required: true,
      },
      {
        id: "first_name",
        label: "First Name",
        pdf: "Applicant First Name",
        required: true,
      },
      { id: "middle_name", label: "Middle Name", pdf: "Applicant Middle Name" },
      {
        id: "dob_month",
        label: "2. Date of Birth - Month (MM)",
        pdf: "Applicant DOB M",
        required: true,
      },
      {
        id: "dob_day",
        label: "Date of Birth - Day (DD)",
        pdf: "Applicant DOB D",
        required: true,
      },
      {
        id: "dob_year",
        label: "Date of Birth - Year (YYYY)",
        pdf: "Applicant DOB Y",
        required: true,
      },
      {
        id: "sex",
        label: "3. Sex",
        pdf: "Gender",
        type: "radio",
        required: true,
        options: M_F,
      },
      {
        id: "place_of_birth",
        label: "4. Place of Birth",
        pdf: "Applicant Place of Birth",
        required: true,
        helpText:
          "City and state if in the U.S., or city and country as it is presently known.",
      },
      {
        id: "ssn_1",
        label: "5. Social Security Number - first 3",
        pdf: "Applicant SSN 1",
        required: true,
      },
      {
        id: "ssn_2",
        label: "Social Security Number - middle 2",
        pdf: "Applicant SSN 2",
        required: true,
      },
      {
        id: "ssn_3",
        label: "Social Security Number - last 4",
        pdf: "Applicant SSN 3",
        required: true,
      },
      {
        id: "a_number",
        label: "6. USCIS Registration A-Number (if applicable)",
        pdf: "Alien Number",
        helpText:
          "Digits only - the form already prints the leading A- for you.",
      },
      {
        id: "email",
        label: "7. Email",
        pdf: "Applicant Email",
        helpText:
          "Used to check application status at passportstatus.state.gov.",
      },
    ],
  },
  {
    id: "mailing",
    title: "8-9. Mailing Address and Phone",
    description: "Where the State Department will send your passport.",
    fields: [
      {
        id: "mailing_street",
        label: "8. Mailing Address Line 1",
        pdf: "Applicant Address Street",
        required: true,
        helpText:
          "Street/RFD#, P.O. Box, or URB. Also include apartment, suite, etc.",
      },
      {
        id: "mailing_line2",
        label: "Address Line 2",
        pdf: "Address Line 2",
        helpText:
          "If the applicant is a child, write In Care Of the parent. Example: In Care Of - Jane Doe.",
      },
      {
        id: "mailing_city",
        label: "City",
        pdf: "Applicant Address City",
        required: true,
      },
      {
        id: "mailing_state",
        label: "State",
        pdf: "Applicant Address State",
        required: true,
      },
      {
        id: "mailing_zip",
        label: "Zip Code",
        pdf: "Applicant Address Zip Code",
        required: true,
      },
      {
        id: "mailing_country",
        label: "Country (if outside the United States)",
        pdf: "Applicant Address Country",
      },
      {
        id: "phone_1",
        label: "9. Primary Phone - area code",
        pdf: "Applicant Phone 1",
      },
      {
        id: "phone_2",
        label: "Primary Phone - prefix",
        pdf: "Applicant Phone 2",
      },
      {
        id: "phone_3",
        label: "Primary Phone - line number",
        pdf: "Applicant Phone 3",
      },
      {
        id: "other_name_a",
        label: "Other name you have used (A)",
        pdf: "List all other name you have used",
        helpText:
          "Birth name, maiden name, previous marriage, or legal name change.",
      },
      {
        id: "other_name_b",
        label: "Other name you have used (B)",
        pdf: "List all other names you have used",
      },
    ],
  },
  {
    id: "parents",
    title: "10. Parental Information",
    description: "Both parents, as named at their own birth.",
    fields: [
      {
        id: "parent1_first_middle",
        label: "Parent 1 - First and Middle Name (at parent's birth)",
        pdf: "Parent 1 FM Name",
      },
      {
        id: "parent1_last",
        label: "Parent 1 - Last Name (at parent's birth)",
        pdf: "Parent 1 Last Name",
      },
      {
        id: "parent1_dob",
        label: "Parent 1 - Date of Birth (MM/DD/YYYY)",
        pdf: "Parent 1 DOB",
        type: "date",
      },
      {
        id: "parent1_birthplace",
        label: "Parent 1 - Place of Birth",
        pdf: "Parent 1 Place of Birth",
      },
      {
        id: "parent1_sex",
        label: "Parent 1 - Sex",
        pdf: "Parent 1 Gender",
        type: "radio",
        options: M_F,
      },
      {
        id: "parent1_us_citizen",
        label: "Parent 1 - U.S. Citizen?",
        pdf: "Parent 1 US Citizen",
        type: "radio",
        options: YES_NO,
      },
      {
        id: "parent2_first_middle",
        label: "Parent 2 - First and Middle Name (at parent's birth)",
        pdf: "Parent 2 FM Name",
      },
      {
        id: "parent2_last",
        label: "Parent 2 - Last Name (at parent's birth)",
        pdf: "Parent 2 Last Name",
      },
      {
        id: "parent2_dob",
        label: "Parent 2 - Date of Birth (MM/DD/YYYY)",
        pdf: "Parent 2 DOB",
        type: "date",
      },
      {
        id: "parent2_birthplace",
        label: "Parent 2 - Place of Birth",
        pdf: "Parent 2 Place of Birth",
      },
      {
        id: "parent2_sex",
        label: "Parent 2 - Sex",
        pdf: "Parent 2 Gender",
        type: "radio",
        options: M_F,
      },
      {
        id: "parent2_us_citizen",
        label: "Parent 2 - U.S. Citizen?",
        pdf: "Parent 2 US Citizen",
        type: "radio",
        options: YES_NO,
      },
    ],
  },
  {
    id: "marriage",
    title: "11. Marital History",
    fields: [
      {
        id: "ever_married",
        label: "Have you ever been married?",
        pdf: "Ever Married",
        type: "radio",
        options: YES_NO,
      },
      {
        id: "spouse_name",
        label:
          "Full name of current or most recent spouse (Last, First and Middle)",
        pdf: "Full Name of Current Spouse or Most Recent Spouse (Last, first, Middle)",
        showIf: { ever_married: "Yes" },
      },
      {
        id: "spouse_dob",
        label: "Spouse - Date of Birth (MM/DD/YYYY)",
        pdf: "Current Spouse Date of Birth",
        type: "date",
        showIf: { ever_married: "Yes" },
      },
      {
        id: "spouse_birthplace",
        label: "Spouse - Place of Birth",
        pdf: "Current Spouse Place of Birth",
        showIf: { ever_married: "Yes" },
      },
      {
        id: "spouse_us_citizen",
        label: "Spouse - U.S. Citizen?",
        pdf: "Spouse US Citizen",
        type: "radio",
        options: YES_NO,
        showIf: { ever_married: "Yes" },
      },
      {
        id: "marriage_date",
        label: "Date of Marriage (MM/DD/YYYY)",
        pdf: "Date of Marriage (mm/dd/yyyy)",
        type: "date",
        showIf: { ever_married: "Yes" },
      },
      {
        id: "widowed_divorced",
        label: "Have you ever been widowed or divorced?",
        pdf: "Divorced",
        type: "radio",
        options: YES_NO,
        showIf: { ever_married: "Yes" },
      },
      {
        id: "widow_divorce_date",
        label: "Widow/Divorce Date (MM/DD/YYYY)",
        pdf: "Widow/Divorce Date (mm/dd/yyyy)",
        type: "date",
        showIf: { ever_married: "Yes", widowed_divorced: "Yes" },
      },
    ],
  },
  {
    id: "contact-work",
    title: "12-14. Contact, Occupation and Employer",
    fields: [
      {
        id: "additional_phone",
        label: "12. Additional Contact Phone Number",
        pdf: "Applicant Additional Contact Phone Numbers",
      },
      {
        id: "additional_phone_type",
        label: "Additional phone type",
        pdf: "Additional #",
        type: "radio",
        options: [
          { id: "Home", label: "Home" },
          { id: "Work", label: "Work" },
          { id: "Cell", label: "Cell" },
          { id: "Other", label: "Other" },
        ],
      },
      {
        id: "occupation",
        label: "13. Occupation (if age 16 or older)",
        pdf: "Occupation",
      },
      {
        id: "employer_school",
        label: "14. Employer or School (if applicable)",
        pdf: "Employer or School",
      },
    ],
  },
  {
    id: "appearance-travel",
    title: "15-18. Physical Description and Travel Plans",
    fields: [
      {
        id: "height",
        label: "15. Height",
        pdf: "Height",
        helpText: "Feet and inches, for example 5 ft 10 in.",
      },
      { id: "hair_color", label: "16. Hair Color", pdf: "Hair Color" },
      { id: "eye_color", label: "17. Eye Color", pdf: "Eye Color" },
      {
        id: "travel_departure",
        label: "18. Departure Date (MM/DD/YYYY)",
        pdf: "Travel Departure Date",
        type: "date",
        helpText: "If you have no travel plans, write none.",
      },
      {
        id: "travel_return",
        label: "Return Date (MM/DD/YYYY)",
        pdf: "Travel Return Date",
        type: "date",
      },
      {
        id: "travel_countries",
        label: "Countries to be Visited",
        pdf: "Countries to be visited",
      },
    ],
  },
  {
    id: "permanent-address",
    title: "19. Permanent Address",
    description:
      "Complete only if a P.O. Box is listed above, or if your residence differs from your mailing address. Do not list a P.O. Box here.",
    fields: [
      {
        id: "permanent_street",
        label: "Street/RFD # or URB",
        pdf: "Permanent Address Street",
      },
      {
        id: "permanent_apt",
        label: "Apartment/Unit",
        pdf: "Permanent Address Apartment/Unit",
      },
      { id: "permanent_city", label: "City", pdf: "Permanent Address City" },
      { id: "permanent_state", label: "State", pdf: "Permanent Address State" },
      {
        id: "permanent_zip",
        label: "Zip Code",
        pdf: "Permanent Address Zip Code",
      },
    ],
  },
  {
    id: "emergency",
    title: "20. Emergency Contact",
    description:
      "Someone not traveling with you, to be contacted in the event of an emergency.",
    fields: [
      { id: "emergency_name", label: "Name", pdf: "Emergency Contact Name" },
      {
        id: "emergency_address",
        label: "Address: Street/RFD # or P.O. Box",
        pdf: "Emergency Contact Address",
      },
      {
        id: "emergency_apt",
        label: "Apartment/Unit",
        pdf: "Emergency Contact Apartment/Unit",
      },
      { id: "emergency_city", label: "City", pdf: "Emergency Contact City" },
      { id: "emergency_state", label: "State", pdf: "Emergency Contact State" },
      {
        id: "emergency_zip",
        label: "Zip Code",
        pdf: "Emergency Contact Zip Code",
      },
      {
        id: "emergency_phone",
        label: "Phone Number",
        pdf: "Emergency Contact Phone",
      },
      {
        id: "emergency_relationship",
        label: "Relationship",
        pdf: "Relationship to Applicant",
      },
    ],
  },
  {
    id: "prior-passport",
    title: "21. Previous U.S. Passport",
    fields: [
      {
        id: "ever_applied",
        label:
          "Have you ever applied for or been issued a U.S. Passport Book or Passport Card?",
        pdf: "Ever Applied or Issued",
        type: "radio",
        options: YES_NO,
      },
      {
        id: "prior_book_name",
        label: "Name printed on your most recent book",
        pdf: "Your name as printed on your most recent U.S. passport book and/or passport card",
        showIf: { ever_applied: "Yes" },
      },
      {
        id: "book_status",
        label: "Status of Book",
        pdfPrefix: "Book Status",
        type: "radio",
        options: DOCUMENT_STATUS,
        showIf: { ever_applied: "Yes" },
      },
      {
        id: "prior_card_name",
        label: "Name printed on your most recent card",
        pdf: "Name as printed on your most recent passport card",
        showIf: { ever_applied: "Yes" },
      },
      {
        id: "card_status",
        label: "Status of Card",
        pdfPrefix: "Card Status",
        type: "radio",
        options: DOCUMENT_STATUS,
        showIf: { ever_applied: "Yes" },
      },
      {
        id: "loss_circumstances",
        label:
          "If your most recent book or card was lost or stolen, explain in detail",
        pdf: "Circumstances of lost/stolen book/card",
        showIf: { ever_applied: "Yes" },
        helpText:
          "Include the previous book or card number, the date and location of the loss or theft, and whether you filed a police report.",
      },
    ],
  },
];

/** Completed in person by the acceptance agent, or mirrored by the filler. */
const EXPECTED_UNMAPPED = new Set([
  "Clear",
  "Name of Applicant 2",
  "Applicant DOB 2",
]);

const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf8"));
const byName = new Map(raw.map((f) => [f.name, f]));
const used = new Set();
const problems = [];

const sections = SECTIONS.map((section) => ({
  id: section.id,
  title: section.title,
  description: section.description,
  fields: section.fields.map(buildField).filter(Boolean),
}));

for (const field of raw) {
  if (used.has(field.name) || EXPECTED_UNMAPPED.has(field.name)) continue;
  problems.push(`unmapped PDF field: "${field.name}"`);
}

if (problems.length) {
  console.error(
    `Refusing to write schema:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}

fs.writeFileSync(OUT_PATH, render(sections));
writeBackendArtifacts(sections);

const fieldCount = sections.reduce((n, s) => n + s.fields.length, 0);

console.log(
  `Wrote ${sections.length} sections / ${fieldCount} fields -> ${path.relative(ROOT, OUT_PATH)}`,
);
console.log(
  `Mapped ${used.size} of ${raw.length} PDF fields (${EXPECTED_UNMAPPED.size} intentionally unmapped).`,
);

function buildField(spec) {
  return (spec.type ?? "text") === "radio"
    ? buildRadioField(spec)
    : buildTextField(spec);
}

function buildTextField(spec) {
  const src = byName.get(spec.pdf);

  if (!src) {
    problems.push(`${spec.id}: no PDF field named "${spec.pdf}"`);

    return null;
  }
  used.add(spec.pdf);

  return {
    id: spec.id,
    label: spec.label,
    type: spec.type ?? "text",
    required: Boolean(spec.required),
    pdfRef: spec.pdf,
    rect: widgetRect(src.widgets[0]),
    maxLength: typeof src.maxLength === "number" ? src.maxLength : undefined,
    multiline: src.flags.names.includes("Multiline") || undefined,
    showIf: spec.showIf,
    helpText: spec.helpText,
  };
}

function buildRadioField(spec) {
  const options = spec.pdfPrefix
    ? buildPrefixedOptions(spec)
    : buildWidgetOptions(spec);
  const rects = options.map((o) => o.rect).filter(Boolean);

  return {
    id: spec.id,
    label: spec.label,
    type: "radio",
    required: Boolean(spec.required),
    pdfRef: spec.pdfPrefix ?? spec.pdf,
    prefixed: Boolean(spec.pdfPrefix),
    rect: rects.length ? boundingRect(rects) : null,
    options,
    showIf: spec.showIf,
    helpText: spec.helpText,
  };
}

/**
 * Status-of-book and status-of-card are four independent single-widget
 * checkboxes named "<prefix> <export value>". The PDF happily allows two at
 * once; modelling them as one radio is what makes them mutually exclusive.
 */
function buildPrefixedOptions(spec) {
  return spec.options.map((opt) => {
    const name = `${spec.pdfPrefix} ${opt.id}`;
    const src = byName.get(name);

    if (!src) {
      problems.push(`${spec.id}: no PDF field named "${name}"`);

      return { ...opt, rect: null };
    }
    used.add(name);

    return { ...opt, rect: widgetRect(src.widgets[0]) };
  });
}

/**
 * The remaining groups are a single checkbox field carrying several widgets,
 * one per export value. Widget order is not consistent across the form —
 * "Parent 1 Gender" is F,M while "Parent 2 Gender" is M,F — so options are
 * matched on export value, never on index.
 */
function buildWidgetOptions(spec) {
  const src = byName.get(spec.pdf);

  if (!src) {
    problems.push(`${spec.id}: no PDF field named "${spec.pdf}"`);

    return spec.options.map((opt) => ({ ...opt, rect: null }));
  }
  used.add(spec.pdf);

  return spec.options.map((opt) => {
    const widget = src.widgets.find((w) => w.onValue === opt.id);

    if (!widget) {
      const available = src.widgets.map((w) => w.onValue).join(", ");

      problems.push(
        `${spec.id}: "${spec.pdf}" has no widget with export value "${opt.id}" (has: ${available})`,
      );

      return { ...opt, rect: null };
    }

    return { ...opt, rect: widgetRect(widget) };
  });
}

function widgetRect(w) {
  return { page: w.page, x: w.x, y: w.y, w: w.width, h: w.height };
}

function boundingRect(rects) {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));

  return {
    page: rects[0].page,
    x: round(minX),
    y: round(minY),
    w: round(maxX - minX),
    h: round(maxY - minY),
  };
}

function render(secs) {
  return `import type { FormSchema } from "@/lib/shared/types/forms.types";

import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Canonical DS-11 schema (edition 04-2025, OMB 1405-0004).
 *
 * GENERATED by scripts/build-ds11-schema.mjs from schemas/ds11-raw-fields.json.
 * Edit the section and label table in that script and re-run, rather than
 * editing this file, so every rect stays sourced from the real AcroForm
 * widget instead of being hand-authored.
 *
 * All 99 widgets live on PDF pages 5 and 6; pages 1-4 are instructions. The
 * bottom of page 5 and everything under "FOR ISSUING OFFICE ONLY" on page 6
 * are completed in person by the acceptance agent and carry no fields.
 *
 * Option ids are the AcroForm export values verbatim, so the overlay, the
 * preview stamper and the backend filler need no translation table.
 *
 * "Name of Applicant 2" and "Applicant DOB 2" — the repeated header on page 6
 * — are deliberately absent: the filler mirrors them from the page 5 values
 * rather than asking for the same details twice.
 */
export const DS_11_SCHEMA: FormSchema = {
  id: "ds-11",
  label: "Form DS-11",
  pdfUrl: ROUTES.STATIC.DS11_BLANK_PDF,
  pageCount: 6,
  sections: [
${secs.map(renderSection).join("\n")}  ],
};
`;
}

function renderSection(s) {
  const description = s.description
    ? `      description: ${JSON.stringify(s.description)},\n`
    : "";

  return `    {
      id: ${JSON.stringify(s.id)},
      title: ${JSON.stringify(s.title)},
${description}      fields: [
${s.fields.map(renderField).join("\n")}      ],
    },
`;
}

function renderField(f) {
  const lines = [
    `          id: ${JSON.stringify(f.id)},`,
    `          label: ${JSON.stringify(f.label)},`,
    `          type: ${JSON.stringify(f.type)},`,
    `          required: ${f.required},`,
    `          pdfRef: ${JSON.stringify(f.pdfRef)},`,
    `          rect: ${renderRect(f.rect)},`,
  ];

  if (f.options) lines.push(renderOptions(f.options));
  if (typeof f.maxLength === "number") {
    lines.push(`          maxLength: ${f.maxLength},`);
  }
  if (f.multiline) lines.push("          multiline: true,");
  if (f.showIf) lines.push(`          showIf: ${JSON.stringify(f.showIf)},`);
  if (f.helpText) {
    lines.push(`          helpText: ${JSON.stringify(f.helpText)},`);
  }

  return `        {\n${lines.join("\n")}\n        },`;
}

function renderOptions(options) {
  const rendered = options
    .map(
      (o) =>
        `            {\n              id: ${JSON.stringify(o.id)},\n              label: ${JSON.stringify(o.label)},\n              rect: ${renderRect(o.rect)},\n            },`,
    )
    .join("\n");

  return `          options: [\n${rendered}\n          ],`;
}

function renderRect(r) {
  return r ? `{ page: ${r.page}, x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} }` : "null";
}

function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * The backend filler needs the same 84 field names, export values and comb
 * limits. Emitting them from this one table is what stops the two repos
 * drifting on near-identical names such as "List all other name you have
 * used" versus "List all other names you have used".
 */
function writeBackendArtifacts(secs) {
  const backendRoot = path.resolve(ROOT, "../pdf-viewer-backend");

  if (!fs.existsSync(backendRoot)) {
    console.warn(`Skipped backend artifacts: ${backendRoot} not found.`);

    return;
  }

  const fieldsPath = path.join(
    backendRoot,
    "src/form-templates/form-fillers/ds-11.fields.ts",
  );
  const schemaPath = path.join(
    backendRoot,
    "assets/forms/schemas/ds-11.schema.json",
  );

  fs.writeFileSync(fieldsPath, renderBackendFields(secs));
  fs.writeFileSync(schemaPath, renderBackendSchema(secs));
  console.log(`Wrote ${path.relative(ROOT, fieldsPath)}`);
  console.log(`Wrote ${path.relative(ROOT, schemaPath)}`);
}

function collectBackendTables(secs) {
  const text = [];
  const choice = [];
  const status = [];
  const limits = [];
  const required = [];

  for (const section of secs) {
    for (const f of section.fields) {
      if (f.required) required.push(f);
      if (f.type === "radio") {
        (f.prefixed ? status : choice).push(f);
        continue;
      }
      text.push(f);
      if (typeof f.maxLength === "number") limits.push(f);
    }
  }

  return { text, choice, status, limits, required };
}

function renderBackendFields(secs) {
  const t = collectBackendTables(secs);
  const entries = (rows) => rows.join("\n");

  return `/**
 * DS-11 AcroForm field names, export values and comb limits.
 *
 * GENERATED by pdf-viewer-app/scripts/build-ds11-schema.mjs from the blank
 * PDF. Do not hand-edit: regenerate in the frontend repo so the client
 * schema and this table stay in step.
 */

/** Value key to AcroForm text field name. */
export const DS11_TEXT_FIELDS: Readonly<Record<string, string>> = {
${entries(t.text.map((f) => `  ${f.id}: ${JSON.stringify(f.pdfRef)},`))}
};

/**
 * Groups rendered as one checkbox field carrying several widgets, one per
 * export value. pdf-lib refuses to set any value but the first widget, so
 * the filler writes these through the acro dict directly.
 */
export const DS11_CHOICE_GROUPS: Readonly<
  Record<string, { field: string; values: readonly string[] }>
> = {
${entries(
  t.choice.map(
    (f) =>
      `  ${f.id}: { field: ${JSON.stringify(f.pdfRef)}, values: [${f.options.map((o) => JSON.stringify(o.id)).join(", ")}] },`,
  ),
)}
};

/**
 * Four independent single-widget checkboxes named "<prefix> <value>". The
 * PDF allows ticking several at once; treating them as one value is what
 * makes them mutually exclusive.
 */
export const DS11_STATUS_GROUPS: Readonly<
  Record<string, { prefix: string; values: readonly string[] }>
> = {
${entries(
  t.status.map(
    (f) =>
      `  ${f.id}: { prefix: ${JSON.stringify(f.pdfRef)}, values: [${f.options.map((o) => JSON.stringify(o.id)).join(", ")}] },`,
  ),
)}
};

/** Comb and capped field limits, straight from the widget dictionaries. */
export const DS11_MAX_LENGTHS: Readonly<Record<string, number>> = {
${entries(t.limits.map((f) => `  ${f.id}: ${f.maxLength},`))}
};

/** Fields whose widget carries the Multiline flag; newlines are meaningful. */
export const DS11_MULTILINE_FIELDS: readonly string[] = [
${entries(t.text.filter((f) => f.multiline).map((f) => `  ${JSON.stringify(f.id)},`))}
];

/** Fields that only apply while another answer holds, keyed by field id. */
export const DS11_CONDITIONAL_FIELDS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
${entries(
  secs
    .flatMap((sec) => sec.fields)
    .filter((f) => f.showIf)
    .map((f) => `  ${f.id}: ${JSON.stringify(f.showIf)},`),
)}
};

export const DS11_REQUIRED_FIELDS: readonly { key: string; label: string }[] = [
${entries(t.required.map((f) => `  { key: ${JSON.stringify(f.id)}, label: ${JSON.stringify(f.label)} },`))}
];

/** Page 6 repeats the name and date of birth; the filler mirrors page 5. */
export const DS11_MIRRORED_FIELDS = {
  nameOfApplicant: "Name of Applicant 2",
  dateOfBirth: "Applicant DOB 2",
} as const;

/** Pushbutton with no bearing on the filled output; removed before flatten. */
export const DS11_CLEAR_BUTTON = "Clear";
`;
}

function renderBackendSchema(secs) {
  return `${JSON.stringify(
    {
      slug: "ds-11",
      version: 1,
      title: "U.S. Department of State Form DS-11 — Application for a U.S. Passport",
      edition: "04-2025",
      sections: secs.map((s) => ({
        id: s.id,
        label: s.title,
        fields: s.fields.map((f) => ({
          key: f.id,
          label: f.label,
          type: f.type === "radio" ? "enum" : "text",
          required: f.required,
          ...(f.options ? { values: f.options.map((o) => o.id) } : {}),
          ...(typeof f.maxLength === "number"
            ? { maxLength: f.maxLength }
            : {}),
          ...(f.showIf ? { showIf: f.showIf } : {}),
        })),
      })),
    },
    null,
    2,
  )}\n`;
}
