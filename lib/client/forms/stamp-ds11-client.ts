import type { FormField } from "@/lib/shared/types/forms.types";
import type { PDFDocument, PDFForm, PDFTextField } from "pdf-lib";

import { DS_11_SCHEMA } from "@/lib/client/forms/ds-11-schema";
import { fieldIsVisible } from "@/components/sections/forms/visibility";
import { ROUTES } from "@/lib/shared/constants/routes";

/** Application pages 1 and 2 are PDF pages 5 and 6; the rest are instructions. */
const APPLICATION_PAGE_INDEXES = [4, 5];

const CLEAR_BUTTON = "Clear";

/**
 * One fixed size for every text field, in points.
 *
 * Previously only multiline fields got an explicit size and everything else fell
 * through to the template's auto-size default appearance, which scales text to
 * each field's own box height — so taller boxes rendered visibly larger and the
 * filled form looked ragged. Derived from the geometry: widgets are 19.1-35.4pt
 * tall and comb cells 12.5-16.9pt wide, so height binds at roughly 13.2pt on the
 * shortest box and 9pt clears it.
 *
 */
const FIELD_FONT_SIZE = 9;

/**
 * The single multiline box keeps a smaller size. See `applyFontSize` — at 9pt a
 * full 250-character entry fills all three available lines exactly, leaving no
 * room for a typed line break.
 */
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

/**
 * Pins a field to one size by writing its default appearance outright, on the
 * field AND on each of its widgets.
 *
 * The blank DS-11 is inconsistent three ways: 26 text fields carry
 * `/Arial 18 Tf` (the oversized ones), 35 carry `/Arial 0 Tf` — auto-size, which
 * scales text to each box's own height — and 2 carry no field-level /DA at all,
 * only a widget-level one.
 *
 * Both halves are needed. `setFontSize` edits the field's /DA and throws
 * ("No /DA (default appearance) entry found") when there is none, so it cannot
 * touch that last pair. And writing only the field's /DA still leaves them
 * alone, because a widget-level /DA overrides the field's (PDF 32000-1
 * 12.7.3.3) — which is why those two kept rendering at 17 and 18pt after the
 * other 61 had been fixed.
 *
 * /Arial is what the other fields use and is present in the AcroForm /DR.
 */
async function applyFontSize(field: PDFTextField) {
  const { PDFName, PDFString } = await import("pdf-lib");
  // The one multiline box ("Circumstances of lost/stolen book/card") stays a
  // point smaller. It holds 250 characters in a 558x35pt box: at 8pt that wraps
  // to 2 of the 3 available lines, at 9pt to exactly 3 — no margin, so a single
  // typed line break would push the last line out of the box and clip it.
  const size = field.isMultiline() ? MULTILINE_FONT_SIZE : FIELD_FONT_SIZE;
  const da = PDFString.of(`/Arial ${size} Tf 0 g`);

  field.acroField.dict.set(PDFName.of("DA"), da);
  for (const widget of field.acroField.getWidgets()) {
    widget.dict.set(PDFName.of("DA"), da);
  }
  // Keeps pdf-lib's own cached size in step with the /DA just written, so the
  // appearance `save()` regenerates uses this size.
  field.setFontSize(size);
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

async function stampFields(form: PDFForm, values: Record<string, string>) {
  const fields = DS_11_SCHEMA.sections.flatMap((s) => s.fields);

  for (const field of fields) {
    const raw = (values[field.id] ?? "").trim();

    if (!raw) continue;

    // A value whose `showIf` no longer holds must never reach the PDF. The
    // store prunes these as soon as the controlling field changes, but a draft
    // saved before that guard existed can still carry one, and it would print
    // beside a box the applicant has since unticked.
    if (!fieldIsVisible(field, values)) continue;

    if (field.type === "radio") {
      if (isPrefixedGroup(field)) {
        checkBox(form, `${field.pdfRef} ${raw}`);
      } else {
        await selectWidget(form, field.pdfRef, raw);
      }
      continue;
    }

    await setText(form, field.pdfRef, raw, field.maxLength);
  }

  await stampPageTwoHeader(form, values);
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
  form.flatten();

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
