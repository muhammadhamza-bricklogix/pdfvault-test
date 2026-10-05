/**
 * Generate the DS-82 schemas from the injected template.
 *
 * Mirrors `build-ds11-schema.mjs`: a hand-authored section/label table supplies
 * the human half (ids, labels, types, requiredness, conditionals) and the PDF
 * supplies the geometry, so no rect is ever hand-typed into the schema. The one
 * difference is where the geometry comes from — DS-11 reads a dumped
 * `ds11-raw-fields.json`, whereas DS-82's widgets are ones we injected
 * ourselves, so this reads `public/static/forms/ds82.pdf` directly. That also
 * makes it a read-back check on the injection.
 *
 * Option ids are the AcroForm export values verbatim, so the overlay, the
 * client stamper and the backend filler need no translation table.
 *
 * Refuses to write while any PDF field is unmapped or any mapping names a field
 * the PDF does not have — the same guard DS-11 uses, and the thing that stops a
 * renamed field silently dropping out of the form.
 *
 * Usage:
 *   node scripts/build-ds82-template.mjs && node scripts/build-ds82-schema.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, PDFName } from "pdf-lib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PDF_PATH = path.join(ROOT, "public/static/forms/ds82.pdf");
const CLIENT_OUT = path.join(ROOT, "lib/client/forms/ds-82-schema.ts");
const BACKEND_ROOT = path.resolve(ROOT, "../pdf-viewer-backend");
const BACKEND_FIELDS_OUT = path.join(
  BACKEND_ROOT,
  "src/form-templates/form-fillers/ds-82.fields.ts",
);
const BACKEND_SCHEMA_OUT = path.join(
  BACKEND_ROOT,
  "assets/forms/schemas/ds-82.schema.json",
);

/** Widgets we deliberately do not surface. */
const EXPECTED_UNMAPPED = [];

const t = (id, label, pdf, extra = {}) => ({ id, label, pdf, type: "text", ...extra });
/**
 * A date field, rendered by DateField with a calendar glyph and a native
 * picker. The store holds the display string `MM/DD/YYYY`.
 *
 * "Book Issue Date" and "Card Issue Date" are comb boxes of 8 cells expecting
 * MMDDYYYY, so the separators have to come back out before stamping — see
 * COMB_DATE_FIELDS in stamp-ds82-client.ts and in the backend filler.
 */
const d = (id, label, pdf, extra = {}) => ({ id, label, pdf, type: "date", ...extra });
const choice = (id, label, pdf, options, extra = {}) => ({
  id,
  label,
  pdf,
  type: "radio",
  options,
  ...extra,
});

const SECTIONS = [
  {
    id: "document",
    title: "Document Selection",
    description: "Which passport product you are renewing.",
    fields: [
      choice("doc_type", "Select document(s) for which you are applying", "Selection", [
        { id: "Book", label: "U.S. Passport Book" },
        { id: "Card", label: "U.S. Passport Card" },
        { id: "Both", label: "Both" },
      ], {
        required: true,
        helpText: "The passport card is not valid for international air travel.",
      }),
      choice("book_size", "Book size", "Book Size", [
        { id: "Regular", label: "Regular Book (Standard)" },
        { id: "Large", label: "Large Book (Non-Standard)" },
      ], {
        helpText:
          "The large book is for frequent international travelers who need more visa pages.",
      }),
    ],
  },
  {
    id: "applicant",
    title: "1-7. Your Details",
    description: "Name, date and place of birth, and how to reach you.",
    fields: [
      t("last_name", "Last name", "Last Name", { required: true }),
      t("first_name", "First name", "First Name", { required: true }),
      t("middle_name", "Middle name", "Middle Name"),
      t("dob_month", "Date of birth — month", "DOB Month", { required: true }),
      t("dob_day", "Date of birth — day", "DOB Day", { required: true }),
      t("dob_year", "Date of birth — year", "DOB Year", { required: true }),
      choice("sex", "Sex", "Gender", [
        { id: "M", label: "M" },
        { id: "F", label: "F" },
      ]),
      t("place_of_birth", "Place of birth", "Place of Birth", { required: true }),
      t("ssn_1", "Social security number — first 3", "SSN 1"),
      t("ssn_2", "Social security number — middle 2", "SSN 2"),
      t("ssn_3", "Social security number — last 4", "SSN 3"),
      t("email", "Email", "Email", {
        helpText: "Used to check application status at passportstatus.state.gov.",
      }),
      t("primary_phone", "Primary contact phone number", "Primary Phone"),
    ],
  },
  {
    id: "mailing_address",
    title: "8. Mailing Address",
    description: "Where your new passport should be sent.",
    fields: [
      t("mailing_address_1", "Street / RFD # / P.O. Box / URB", "Mailing Address 1", {
        required: true,
      }),
      t("mailing_address_2", "Apartment, suite, in care of", "Mailing Address 2"),
      t("mailing_city", "City", "Mailing City", { required: true }),
      t("mailing_state", "State", "Mailing State"),
      t("mailing_zip", "Zip code", "Mailing Zip"),
      t("mailing_country", "Country (if outside the United States)", "Mailing Country"),
    ],
  },
  {
    id: "other_names",
    title: "9. Other Names Used",
    description: "Birth name, maiden name, previous marriage or legal name change.",
    fields: [
      t("other_name_a", "Other name A", "Other Name A"),
      t("other_name_b", "Other name B", "Other Name B"),
    ],
  },
  {
    id: "passport",
    title: "10. U.S. Passport Information",
    description: "The most recent passport book and/or card you are renewing.",
    fields: [
      t("passport_name", "Name as printed on your most recent passport", "Passport Name", {
        required: true,
      }),
      t("book_number", "Most recent passport book number", "Book Number"),
      d("book_issue_date", "Book issue date", "Book Issue Date"),
      t("card_number", "Most recent passport card number", "Card Number"),
      d("card_issue_date", "Card issue date", "Card Issue Date"),
    ],
  },
  {
    id: "name_change",
    title: "11. Name Change Information",
    description: "Complete only if your name differs from your most recent passport.",
    fields: [
      choice("name_change_reason", "Name changed by", "Name Change Reason", [
        { id: "Marriage", label: "Changed by marriage" },
        { id: "CourtOrder", label: "Changed by court order" },
      ]),
      t("name_change_place", "Place of name change (city / state)", "Name Change Place"),
      d("name_change_date", "Date of name change", "Name Change Date"),
    ],
  },
  {
    id: "page2_header",
    title: "Page 2 Header",
    description:
      "Repeated at the top of page 2. Left blank, these are filled from your details on page 1.",
    fields: [
      t("applicant_name_page2", "Name of applicant (last, first & middle)", "Name of Applicant 2"),
      d("applicant_dob_page2", "Date of birth", "Applicant DOB 2"),
    ],
  },
  {
    id: "description",
    title: "12-16. Description and Employment",
    fields: [
      t("height", "Height", "Height"),
      t("hair_color", "Hair color", "Hair Color"),
      t("eye_color", "Eye color", "Eye Color"),
      t("occupation", "Occupation (if age 16 or older)", "Occupation"),
      t("employer", "Employer or school (if applicable)", "Employer or School"),
    ],
  },
  {
    id: "additional_contact",
    title: "17. Additional Contact Phone Numbers",
    fields: [
      t("additional_phone_1", "Additional phone number 1", "Additional Phone 1"),
      // The printed grid has a fourth, unlabelled box followed by a ruled line
      // to write the type in, so "Other" pairs with a free-text field.
      choice("additional_phone_1_type", "Phone 1 type", "Additional Phone 1 Type", [
        { id: "Home", label: "Home" },
        { id: "Work", label: "Work" },
        { id: "Cell", label: "Cell" },
        { id: "Other", label: "Other" },
      ]),
      // Only live while "Other" is the selected type. The group is
      // single-select, so picking Home/Work/Cell deselects Other and this
      // disappears; the store clears it at the same time so a stale value
      // cannot be stamped into a form that no longer shows the field.
      t(
        "additional_phone_1_other",
        "Phone 1 other type",
        "Additional Phone 1 Other",
        { showIf: { additional_phone_1_type: "Other" } },
      ),
      t("additional_phone_2", "Additional phone number 2", "Additional Phone 2"),
      choice("additional_phone_2_type", "Phone 2 type", "Additional Phone 2 Type", [
        { id: "Home", label: "Home" },
        { id: "Work", label: "Work" },
        { id: "Cell", label: "Cell" },
        { id: "Other", label: "Other" },
      ]),
      t(
        "additional_phone_2_other",
        "Phone 2 other type",
        "Additional Phone 2 Other",
        { showIf: { additional_phone_2_type: "Other" } },
      ),
    ],
  },
  {
    id: "permanent_address",
    title: "18. Permanent Address",
    description:
      "Complete if a P.O. Box is listed as your mailing address, or if you live elsewhere. Do not list a P.O. Box.",
    fields: [
      t("permanent_street", "Street / RFD # or URB", "Permanent Street"),
      t("permanent_apartment", "Apartment / unit", "Permanent Apartment"),
      t("permanent_city", "City", "Permanent City"),
      t("permanent_state", "State", "Permanent State"),
      t("permanent_zip", "Zip code", "Permanent Zip"),
      t("permanent_country", "Country", "Permanent Country"),
    ],
  },
  {
    id: "emergency_contact",
    title: "19. Emergency Contact",
    description:
      "Someone not travelling with you, to be contacted in the event of an emergency.",
    fields: [
      t("emergency_name", "Name", "Emergency Name"),
      t("emergency_street", "Street / RFD # or P.O. Box", "Emergency Street"),
      t("emergency_apartment", "Apartment / unit", "Emergency Apartment"),
      t("emergency_city", "City", "Emergency City"),
      t("emergency_state", "State", "Emergency State"),
      t("emergency_zip", "Zip code", "Emergency Zip"),
      t("emergency_country", "Country", "Emergency Country"),
      t("emergency_email", "Email", "Emergency Email"),
      t("emergency_phone", "Phone number", "Emergency Phone"),
      t("emergency_relationship", "Relationship to applicant", "Emergency Relationship"),
    ],
  },
  {
    id: "travel_plans",
    title: "20. Travel Plans",
    description: 'If you have no travel plans, write "none".',
    fields: [
      d("departure_date", "Departure date", "Departure Date"),
      d("return_date", "Return date", "Return Date"),
      t("countries_visited", "Countries to be visited", "Countries To Be Visited"),
    ],
  },
];

// ── read the geometry back out of the template ──────────────────────────────

const doc = await PDFDocument.load(fs.readFileSync(PDF_PATH));
const pages = doc.getPages();
const form = doc.getForm();
const widgets = new Map();

for (const field of form.getFields()) {
  const name = field.getName();
  const entries = field.acroField.getWidgets().map((w) => {
    const r = w.getRectangle();
    const page = pages.findIndex((p) => p.ref === w.P()) + 1;
    const normal = w.getAppearances()?.normal;
    const on =
      normal && normal.keys
        ? normal
            .keys()
            .map((k) => k.toString().replace(/^\//, ""))
            .find((k) => k !== "Off")
        : undefined;

    return {
      page,
      rect: {
        page,
        x: round(r.x),
        y: round(r.y),
        w: round(r.width),
        h: round(r.height),
      },
      on,
    };
  });

  widgets.set(name, {
    kind: field.constructor.name,
    maxLength: field.acroField.dict.get(PDFName.of("MaxLen"))?.asNumber?.(),
    entries,
  });
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function boundingRect(rects) {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));

  return {
    page: rects[0].page,
    x: round(minX),
    y: round(minY),
    w: round(Math.max(...rects.map((r) => r.x + r.w)) - minX),
    h: round(Math.max(...rects.map((r) => r.y + r.h)) - minY),
  };
}

const problems = [];
const claimed = new Set();

const resolved = SECTIONS.map((section) => ({
  ...section,
  fields: section.fields.map((field) => {
    const widget = widgets.get(field.pdf);

    if (!widget) {
      problems.push(`"${field.id}" maps to PDF field "${field.pdf}", which does not exist`);

      return null;
    }
    claimed.add(field.pdf);

    if (field.type === "radio") {
      const options = field.options.map((option) => {
        const match = widget.entries.find((e) => e.on === option.id);

        if (!match) {
          problems.push(
            `"${field.id}" option "${option.id}" has no widget on PDF field "${field.pdf}"`,
          );

          return null;
        }

        return { ...option, rect: match.rect };
      });

      if (options.includes(null)) return null;

      return { ...field, options, rect: boundingRect(options.map((o) => o.rect)) };
    }

    const [first] = widget.entries;

    return {
      ...field,
      rect: first.rect,
      ...(widget.maxLength ? { maxLength: widget.maxLength } : {}),
    };
  }),
}));

for (const name of widgets.keys()) {
  if (!claimed.has(name) && !EXPECTED_UNMAPPED.includes(name)) {
    problems.push(`unmapped PDF field: "${name}"`);
  }
}

if (problems.length) {
  console.error(
    `Refusing to write the schema:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}

// ── render ──────────────────────────────────────────────────────────────────

const q = (s) => JSON.stringify(s);

function renderField(field) {
  const lines = [
    `        {`,
    `          id: ${q(field.id)},`,
    `          label: ${q(field.label)},`,
    `          type: ${q(field.type)},`,
    `          required: ${field.required ? "true" : "false"},`,
    `          pdfRef: ${q(field.pdf)},`,
    `          rect: { page: ${field.rect.page}, x: ${field.rect.x}, y: ${field.rect.y}, w: ${field.rect.w}, h: ${field.rect.h} },`,
  ];

  if (field.options) {
    lines.push(`          options: [`);
    for (const option of field.options) {
      lines.push(
        `            {`,
        `              id: ${q(option.id)},`,
        `              label: ${q(option.label)},`,
        `              rect: { page: ${option.rect.page}, x: ${option.rect.x}, y: ${option.rect.y}, w: ${option.rect.w}, h: ${option.rect.h} },`,
        `            },`,
      );
    }
    lines.push(`          ],`);
  }
  if (field.maxLength) lines.push(`          maxLength: ${field.maxLength},`);
  if (field.helpText) lines.push(`          helpText: ${q(field.helpText)},`);
  if (field.showIf) lines.push(`          showIf: ${JSON.stringify(field.showIf)},`);
  lines.push(`        },`);

  return lines.join("\n");
}

function renderSection(section) {
  return [
    `    {`,
    `      id: ${q(section.id)},`,
    `      title: ${q(section.title)},`,
    ...(section.description ? [`      description: ${q(section.description)},`] : []),
    `      fields: [`,
    section.fields.map(renderField).join("\n"),
    `      ],`,
    `    },`,
  ].join("\n");
}

const clientSchema = `import type { FormSchema } from "@/lib/shared/types/forms.types";

import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Canonical DS-82 schema (edition 04-2025, OMB 1405-0020).
 *
 * GENERATED by scripts/build-ds82-schema.mjs from public/static/forms/ds82.pdf.
 * Edit the section and label table in that script and re-run, rather than
 * editing this file, so every rect stays sourced from a real AcroForm widget
 * instead of being hand-authored.
 *
 * Unlike every other form we ship, the government DS-82 arrives with NO form
 * fields at all — scripts/build-ds82-template.mjs injects them. The rects below
 * are therefore read back out of that generated template, which makes this file
 * a check on the injection as well as a description of the form.
 *
 * All widgets live on PDF pages 5 and 6; pages 1-4 are instructions. The
 * signature and date lines on page 5 and the "FOR ISSUING OFFICE ONLY" block
 * carry no fields: the applicant signs by hand after printing, and the rest is
 * completed by the passport agency.
 *
 * Option ids are the AcroForm export values verbatim, so the overlay, the
 * client stamper and the backend filler need no translation table.
 */
export const DS_82_SCHEMA: FormSchema = {
  id: "ds-82",
  label: "Form DS-82",
  pdfUrl: ROUTES.STATIC.DS82_BLANK_PDF,
  pageCount: 6,
  sections: [
${resolved.map(renderSection).join("\n")}
  ],
};
`;

fs.writeFileSync(CLIENT_OUT, clientSchema.replace(/\r?\n/g, "\r\n"));

const all = resolved.flatMap((s) => s.fields);
// Everything that is not a choice group is a text field as far as the PDF and
// the backend filler are concerned — "date" is a UI affordance (a picker and a
// calendar glyph), not a different kind of AcroForm widget. Filtering on
// `type === "text"` instead silently dropped the six date fields from the
// backend table, so the server stopped filling them at all. Matches
// `collectBackendTables` in build-ds11-schema.mjs, which buckets by "not radio".
const texts = all.filter((f) => f.type !== "radio");
const choices = all.filter((f) => f.type === "radio");

const backendFields = `/**
 * DS-82 field tables.
 *
 * GENERATED by pdf-viewer-app/scripts/build-ds82-schema.mjs — do not edit by
 * hand; edit the section table in that script and re-run.
 */

export const DS82_TEXT_FIELDS: Record<string, string> = {
${texts.map((f) => `  ${f.id}: ${q(f.pdf)},`).join("\n")}
};

export const DS82_CHOICE_GROUPS: Record<string, { pdf: string; values: string[] }> = {
${choices
  .map(
    (f) =>
      `  ${f.id}: { pdf: ${q(f.pdf)}, values: [${f.options.map((o) => q(o.id)).join(", ")}] },`,
  )
  .join("\n")}
};

export const DS82_MAX_LENGTHS: Record<string, number> = {
${texts
  .filter((f) => f.maxLength)
  .map((f) => `  ${f.id}: ${f.maxLength},`)
  .join("\n")}
};

export const DS82_REQUIRED_FIELDS: string[] = [
${all
  .filter((f) => f.required)
  .map((f) => `  ${q(f.id)},`)
  .join("\n")}
];

/**
 * Page 2 repeats the applicant's name and date of birth. Both are editable in
 * their own right; the filler only mirrors page 1 into them when the applicant
 * has left them blank.
 */
export const DS82_MIRRORED_FIELDS = {
  nameOfApplicant: "Name of Applicant 2",
  dateOfBirth: "Applicant DOB 2",
} as const;
`;

const backendSchema = {
  slug: "ds-82",
  title: "U.S. Passport Renewal Application (DS-82)",
  edition: "04-2025",
  pageCount: 6,
  sections: resolved.map((s) => ({
    id: s.id,
    title: s.title,
    fields: s.fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      required: !!f.required,
      pdfRef: f.pdf,
      ...(f.options ? { options: f.options.map((o) => o.id) } : {}),
      ...(f.maxLength ? { maxLength: f.maxLength } : {}),
    })),
  })),
};

if (fs.existsSync(BACKEND_ROOT)) {
  fs.mkdirSync(path.dirname(BACKEND_SCHEMA_OUT), { recursive: true });
  fs.writeFileSync(BACKEND_FIELDS_OUT, backendFields.replace(/\r?\n/g, "\r\n"));
  fs.writeFileSync(BACKEND_SCHEMA_OUT, `${JSON.stringify(backendSchema, null, 2)}\n`);
  console.log(`  wrote ${path.relative(ROOT, BACKEND_FIELDS_OUT)}`);
  console.log(`  wrote ${path.relative(ROOT, BACKEND_SCHEMA_OUT)}`);
} else {
  console.log("  skipped backend artifacts — ../pdf-viewer-backend not found");
}

console.log(`wrote ${path.relative(ROOT, CLIENT_OUT)}`);
console.log(
  `  mapped ${claimed.size} of ${widgets.size} PDF fields — ${texts.length} text, ${choices.length} choice`,
);
