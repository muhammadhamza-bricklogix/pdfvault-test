import type { PDFDocument, PDFForm, PDFTextField } from "pdf-lib";

import { DS_82_SCHEMA } from "@/lib/client/forms/ds-82-schema";
import { fieldIsVisible } from "@/components/sections/forms/visibility";
import { ROUTES } from "@/lib/shared/constants/routes";

/** Application pages 1 and 2 are PDF pages 5 and 6; the rest are instructions. */
const APPLICATION_PAGE_INDEXES = [4, 5];

/**
 * One fixed size for every text field, in points.
 *
 * Not auto-size (0): that scales each field's text to its own box height, so the
 * taller boxes came out visibly larger than the shorter ones and the filled form
 * looked ragged. Derived from the geometry — widgets are 16.5-20.0pt tall and
 * comb cells 14.9-15.3pt wide, so height binds at roughly 11.6pt and 9pt clears
 * the shortest box.
 *
 * Keep in step with FIELD_FONT_SIZE in scripts/build-ds82-template.mjs and the
 * backend ds-82 filler.
 */
const FIELD_FONT_SIZE = 9;

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

/**
 * Pins a field to one size by writing its default appearance outright.
 *
 * The template already builds every field at this size, so this is belt and
 * braces for our own stamping — but it also guards the case `setFontSize` alone
 * cannot: a field carrying no /DA at all makes pdf-lib throw ("No /DA (default
 * appearance) entry found") rather than create one. Two DS-11 fields are in
 * exactly that state, and this mirrors the fix there.
 *
 * /Helv matches what build-ds82-template.mjs writes and resolves against the
 * AcroForm /DR the source PDF ships.
 */
async function applyFontSize(field: PDFTextField) {
  const { PDFName, PDFString } = await import("pdf-lib");
  const da = PDFString.of(`/Helv ${FIELD_FONT_SIZE} Tf 0 g`);

  field.acroField.dict.set(PDFName.of("DA"), da);
  // A widget-level /DA overrides the field's (PDF 32000-1 12.7.3.3), so both
  // have to be written. See the DS-11 stamper, where two widgets carry their
  // own auto-size /DA and kept rendering at 17 and 18pt when only the field's
  // was set.
  for (const widget of field.acroField.getWidgets()) {
    widget.dict.set(PDFName.of("DA"), da);
  }
  // Keeps pdf-lib's own cached size in step with the /DA just written, so the
  // appearance `save()` regenerates uses this size.
  field.setFontSize(FIELD_FONT_SIZE);
}

async function setText(
  form: PDFForm,
  pdfRef: string,
  raw: string,
  max?: number,
) {
  const value = normalize(raw);

  if (!value) return;
  try {
    const field = form.getTextField(pdfRef);
    const limit = typeof max === "number" ? max : field.getMaxLength();

    field.setText(
      typeof limit === "number" && limit > 0 ? value.slice(0, limit) : value,
    );
    await applyFontSize(field);
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

async function stampPageTwoHeader(
  form: PDFForm,
  values: Record<string, string>,
) {
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

    if (name) await setText(form, MIRRORED_NAME, name);
  }

  if (!typedDob) {
    const dob = [values.dob_month, values.dob_day, values.dob_year].map((v) =>
      (v ?? "").trim(),
    );

    if (dob.every(Boolean)) await setText(form, MIRRORED_DOB, dob.join("/"));
  }
}

/**
 * The two issue-date boxes are combs of exactly 8 cells expecting MMDDYYYY,
 * while the store holds the display form `MM/DD/YYYY` that the date picker
 * writes. Slicing that to the field's maxLength would silently produce
 * "05/01/20", so the separators come out first.
 *
 * Mirrors COMB_DATE_FIELDS and `valueForField` in the backend ds-82 filler —
 * the two must agree, because the same values are stamped by whichever path
 * runs, and the backend validates the stripped form.
 */
const COMB_DATE_FIELDS = ["book_issue_date", "card_issue_date"];

function valueForField(fieldId: string, raw: string): string {
  return COMB_DATE_FIELDS.includes(fieldId) ? raw.replace(/\D/g, "") : raw;
}

async function stampFields(form: PDFForm, values: Record<string, string>) {
  const fields = DS_82_SCHEMA.sections.flatMap((s) => s.fields);

  for (const field of fields) {
    const raw = (values[field.id] ?? "").trim();

    if (!raw) continue;

    // A value whose `showIf` no longer holds must never reach the PDF. The
    // store prunes these as soon as the controlling field changes, but a draft
    // saved before that guard existed can still carry one, and it would print
    // beside a box the applicant has since unticked.
    if (!fieldIsVisible(field, values)) continue;

    if (field.type === "radio") {
      // Every DS-82 choice is one field carrying a widget per export value, so
      // there is only one shape to handle. DS-11 additionally has "prefixed"
      // families — four independent checkboxes it calls a radio to force
      // exclusivity — which exist only because that PDF was authored that way.
      // We author this template, so it has no equivalent here.
      await selectWidget(form, field.pdfRef, raw);
      continue;
    }

    await setText(
      form,
      field.pdfRef,
      valueForField(field.id, raw),
      field.maxLength,
    );
  }

  await stampPageTwoHeader(form, values);
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
 * Fills the blank DS-82 in the browser and returns just the two application
 * pages, for the paywall preview. Deliberately mirrors the backend filler so
 * the preview matches the file the user is about to pay for.
 */
async function stampDs82(
  values: Record<string, string>,
  { applicationPagesOnly }: { applicationPagesOnly: boolean },
): Promise<Uint8Array> {
  const res = await fetch(ROUTES.STATIC.DS82_BLANK_PDF, {
    cache: "force-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to load DS-82 template (HTTP ${res.status})`);
  }
  const templateBytes = new Uint8Array(await res.arrayBuffer());

  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  await stampFields(form, values);
  // Deliberately NOT flattened (product decision 2026-10-04): the applicant
  // should be able to correct the form in their reader after downloading it.
  // Unlike DS-11 there is no Clear button to strip — the government DS-82 draws
  // one as artwork rather than as a field, and our injected template adds only
  // the fields in scripts/ds82-fields.mjs.

  if (!applicationPagesOnly) return pdfDoc.save();

  return extractApplicationPages(pdfDoc);
}

export async function stampDs82Preview(
  values: Record<string, string>,
): Promise<Uint8Array> {
  return stampDs82(values, { applicationPagesOnly: true });
}

export async function stampDs82Document(
  values: Record<string, string>,
): Promise<Uint8Array> {
  return stampDs82(values, { applicationPagesOnly: false });
}
