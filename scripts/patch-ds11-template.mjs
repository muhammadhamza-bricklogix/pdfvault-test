/**
 * Adds the one AcroForm field the government DS-11 is missing.
 *
 *   node scripts/patch-ds11-template.mjs
 *
 * Reads schemas/ds11-source.pdf (the pristine State Department file) and writes
 * public/static/forms/ds11.pdf. Re-running is safe: the field is skipped if it
 * already exists, so the output is deterministic.
 *
 * Why this exists
 * ---------------
 * Item 12, "Additional Contact Phone Number", prints a 2x2 grid of boxes —
 * Home/Cell on the top row, Work and a fourth unlabelled box below. That fourth
 * box is the `/Other` export value of the existing "Additional #" checkbox, and
 * the form prints a ruled line beside it to write the type on. The State
 * Department shipped the checkbox but no field for the line, so an applicant who
 * ticked "other" had nowhere to say what it was — on screen or in the download.
 *
 * Everything downstream fills by AcroForm field name and sources its geometry
 * from the real widget (extract-ds11-fields.mjs -> build-ds11-schema.mjs), so
 * adding the widget here is what lets the editor overlay, the client stamper and
 * the backend filler all pick the field up with no special-casing.
 *
 * After running this, re-run:
 *   node scripts/extract-ds11-fields.mjs
 *   node scripts/build-ds11-schema.mjs
 * and copy the PDF to the backend's assets/forms/ds11.pdf.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, rgb } from "pdf-lib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "schemas/ds11-source.pdf");
const OUT = path.join(ROOT, "public/static/forms/ds11.pdf");

/** Matches FIELD_FONT_SIZE in stamp-ds11-client.ts and the backend filler. */
const FIELD_FONT_SIZE = 9;

/**
 * Item 12's write-in line, measured off a 3x render of page 6 by scanning for
 * the printed rule: it runs x 241.7 -> 277.7 at y 501.0. The field sits on that
 * rule and is as tall as the adjacent "Other" checkbox row.
 *
 * Page 6 is index 5. The name follows the sibling checkbox, "Additional #".
 */
const FIELD = {
  name: "Additional # Other",
  pageIndex: 5,
  rect: { x: 241.7, y: 501, w: 36, h: 10 },
};

const doc = await PDFDocument.load(fs.readFileSync(SOURCE), {
  // Defaults to true, which stamps a fresh ModDate every run and churns 2.5 MB
  // of binary in git for a no-op rebuild.
  updateMetadata: false,
});
const form = doc.getForm();

const exists = form.getFields().some((f) => f.getName() === FIELD.name);

if (exists) {
  console.log(`"${FIELD.name}" already present — nothing to do`);
} else {
  const page = doc.getPages()[FIELD.pageIndex];
  const text = form.createTextField(FIELD.name);

  text.addToPage(page, {
    x: FIELD.rect.x,
    y: FIELD.rect.y,
    width: FIELD.rect.w,
    height: FIELD.rect.h,
    // The form already prints the rule and the surrounding panel; a border or
    // background here would double them up.
    borderWidth: 0,
    backgroundColor: undefined,
    borderColor: undefined,
    textColor: rgb(0, 0, 0),
    size: FIELD_FONT_SIZE,
  });

  // `addToPage` writes a /DA carrying whatever size it laid out with. Restating
  // it keeps this field in step with the size the stamper and filler apply to
  // every other field. /Arial is what the other 61 text fields use and is
  // present in the AcroForm /DR.
  text.acroField.setDefaultAppearance(`/Arial ${FIELD_FONT_SIZE} Tf 0 g`);
}

// Appearances off: the field is empty, and regenerating would bake a concrete
// size over the /DA just written.
fs.writeFileSync(OUT, await doc.save({ updateFieldAppearances: false }));

const after = await PDFDocument.load(fs.readFileSync(OUT));

console.log(`template written: ${path.relative(ROOT, OUT)}`);
console.log(`  ${after.getForm().getFields().length} fields`);
