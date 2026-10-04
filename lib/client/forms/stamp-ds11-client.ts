import type { FormField } from "@/lib/shared/types/forms.types";
import type { PDFDocument, PDFForm } from "pdf-lib";

import { DS_11_SCHEMA } from "@/lib/client/forms/ds-11-schema";
import { ROUTES } from "@/lib/shared/constants/routes";

/** Application pages 1 and 2 are PDF pages 5 and 6; the rest are instructions. */
const APPLICATION_PAGE_INDEXES = [4, 5];

const CLEAR_BUTTON = "Clear";

const MULTILINE_FONT_SIZE = 8;

const MIRRORED_NAME = "Name of Applicant 2";
const MIRRORED_DOB = "Applicant DOB 2";

const EXPANDING_WHITESPACE = new RegExp(
  "[\\t\\n\\f\\r\\v\\u0085\\u2028\\u2029]+",
  "g",
);

/**
 * pdf-lib expands TAB and the Unicode line separators into four spaces while
 * laying out a comb field, so a value trimmed to maxLength beforehand can still
 * overflow its cells and throw. Mirrors `normalizeForPdf` in the backend filler.
 */
function normalize(raw: string): string {
  return raw.replace(EXPANDING_WHITESPACE, " ").replace(/ {2,}/g, " ").trim();
}

function setText(form: PDFForm, pdfRef: string, raw: string, max?: number) {
  const value = normalize(raw);

  if (!value) return;
  try {
    const field = form.getTextField(pdfRef);
    const limit = typeof max === "number" ? max : field.getMaxLength();

    field.setText(
      typeof limit === "number" && limit > 0 ? value.slice(0, limit) : value,
    );
    if (field.isMultiline()) field.setFontSize(MULTILINE_FONT_SIZE);
  } catch {
    /* widget absent — skip */
  }
}

/**
 * Groups such as Selection (Book/Card/Both) are one checkbox field carrying a
 * widget per export value. `check()` only ever writes the first widget and
 * `setValue` throws for any other, so the value and each widget's appearance
 * state are written directly. Matching is on export value, never on index:
 * "Parent 1 Gender" is ordered F,M while "Parent 2 Gender" is M,F.
 */
async function selectWidget(
  form: PDFForm,
  pdfRef: string,
  exportValue: string,
) {
  const { PDFName } = await import("pdf-lib");

  try {
    const field = form.getField(pdfRef);
    const target = PDFName.of(exportValue);
    const widgets = field.acroField.getWidgets();

    if (!widgets.some((w) => w.getOnValue() === target)) return;

    field.acroField.dict.set(PDFName.of("V"), target);
    for (const widget of widgets) {
      widget.setAppearanceState(
        widget.getOnValue() === target ? target : PDFName.of("Off"),
      );
    }
  } catch {
    /* field absent — skip */
  }
}

function checkBox(form: PDFForm, pdfRef: string) {
  try {
    form.getCheckBox(pdfRef).check();
  } catch {
    /* widget absent — skip */
  }
}

/** Status of Book and Status of Card are four separate single-widget boxes. */
function isPrefixedGroup(field: FormField): boolean {
  return field.pdfRef === "Book Status" || field.pdfRef === "Card Status";
}

function stampPageTwoHeader(form: PDFForm, values: Record<string, string>) {
  // Both widgets are now editable in their own right (schema section
  // "page2_header"), so anything typed there has already been written by
  // `stampFields` and must win. Mirroring page 1 is only the fallback for
  // when the user leaves them blank — the printed form repeats the
  // applicant's name and date of birth at the top of page 2.
  const typedName = (values.applicant_name_page2 ?? "").trim();
  const typedDob = (values.applicant_dob_page2 ?? "").trim();

  if (!typedName) {
    const name = [values.last_name, values.first_name, values.middle_name]
      .map((v) => (v ?? "").trim())
      .filter(Boolean)
      .join(", ");

    if (name) setText(form, MIRRORED_NAME, name);
  }

  if (!typedDob) {
    const dob = [values.dob_month, values.dob_day, values.dob_year].map((v) =>
      (v ?? "").trim(),
    );

    if (dob.every(Boolean)) setText(form, MIRRORED_DOB, dob.join("/"));
  }
}

async function stampFields(form: PDFForm, values: Record<string, string>) {
  const fields = DS_11_SCHEMA.sections.flatMap((s) => s.fields);

  for (const field of fields) {
    const raw = (values[field.id] ?? "").trim();

    if (!raw) continue;

    if (field.type === "radio") {
      if (isPrefixedGroup(field)) {
        checkBox(form, `${field.pdfRef} ${raw}`);
      } else {
        await selectWidget(form, field.pdfRef, raw);
      }
      continue;
    }

    setText(form, field.pdfRef, raw, field.maxLength);
  }

  stampPageTwoHeader(form, values);
}

function removeClearButton(form: PDFForm) {
  try {
    form.removeField(form.getField(CLEAR_BUTTON));
  } catch {
    /* not present — nothing to drop */
  }
}

async function extractApplicationPages(
  source: PDFDocument,
): Promise<Uint8Array> {
  const { PDFDocument: Doc } = await import("pdf-lib");
  const preview = await Doc.create();
  const pages = await preview.copyPages(source, APPLICATION_PAGE_INDEXES);

  pages.forEach((page) => preview.addPage(page));

  return preview.save();
}

/**
 * Fills the blank DS-11 in the browser and returns just the two application
 * pages, for the paywall preview. Deliberately mirrors the backend filler so
 * the preview matches the file the user is about to pay for.
 */
async function stampDs11(
  values: Record<string, string>,
  { applicationPagesOnly }: { applicationPagesOnly: boolean },
): Promise<Uint8Array> {
  const res = await fetch(ROUTES.STATIC.DS11_BLANK_PDF, {
    cache: "force-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to load DS-11 template (HTTP ${res.status})`);
  }
  const templateBytes = new Uint8Array(await res.arrayBuffer());

  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  await stampFields(form, values);
  removeClearButton(form);
  // Deliberately NOT flattened (product decision 2026-10-04): the applicant
  // should be able to correct the form in their reader after downloading it.
  // The Clear button is still stripped above, so a live form cannot be wiped
  // in one click.

  if (!applicationPagesOnly) return pdfDoc.save();

  return extractApplicationPages(pdfDoc);
}

export async function stampDs11Preview(
  values: Record<string, string>,
): Promise<Uint8Array> {
  return stampDs11(values, { applicationPagesOnly: true });
}

export async function stampDs11Document(
  values: Record<string, string>,
): Promise<Uint8Array> {
  return stampDs11(values, { applicationPagesOnly: false });
}
