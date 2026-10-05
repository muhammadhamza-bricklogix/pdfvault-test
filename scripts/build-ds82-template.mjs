/**
 * Build the fillable DS-82 template.
 *
 * `schemas/ds82-source.pdf` is the government original and has NO form fields —
 * see the note in `ds82-fields.mjs`. This script injects the widget layer that
 * the rest of the pipeline assumes, writing `public/static/forms/ds82.pdf`.
 *
 * Widgets are borderless and transparent so the form's own printed boxes show
 * through, exactly as the DS-11's own widgets do. The output is NOT flattened
 * and never should be: downloads stay editable (product decision 2026-10-04,
 * commit be7969c), and `stamp-ds82-client.ts` fills these same widgets by name.
 *
 * Re-runnable: it always starts from the pristine source, so changing the field
 * table and re-running produces the same result as a clean build.
 *
 * Usage:
 *   node scripts/build-ds82-template.mjs            # build
 *   node scripts/build-ds82-template.mjs --probe    # build + fill each field
 *                                                   # with its own name, for a
 *                                                   # visual geometry check
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, PDFName, PDFDict, PDFRef, rgb } from "pdf-lib";

import { FIELDS } from "./ds82-fields.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "schemas/ds82-source.pdf");
const OUT = path.join(ROOT, "public/static/forms/ds82.pdf");
const PROBE_OUT = path.join(ROOT, "tmp/ds82-probe.pdf");

const probe = process.argv.includes("--probe");

/**
 * One fixed size for every text field, in points.
 *
 * Chosen from the geometry rather than by eye: the widgets are 16.5-20.0pt tall
 * and the comb cells 14.9-15.3pt wide, so height is the binding constraint and
 * the ceiling is about 11.6pt. 9pt clears it comfortably on the shortest box and
 * matches the density of the printed form.
 *
 * Keep in step with FIELD_FONT_SIZE in lib/client/forms/stamp-ds82-client.ts and
 * the backend ds-82 filler: the template governs what the recipient sees when
 * they type into the downloaded form, the other two what we stamp into it.
 */
const FIELD_FONT_SIZE = 9;

// `updateMetadata` defaults to true, which stamps a fresh ModDate on every run
// and churns 1.6 MB of binary in git for a no-op rebuild.
const doc = await PDFDocument.load(fs.readFileSync(SOURCE), {
  updateMetadata: false,
});
const form = doc.getForm();
const pages = doc.getPages();

// The government original carries three review comments on page 3 (Highlight +
// Popup pairs). Left in, they render as yellow highlights and sticky notes in
// the applicant's download. Drop every annotation that is not a form widget.
let droppedAnnots = 0;

for (const page of pages) {
  const annots = page.node.Annots();

  if (!annots) continue;

  const kept = annots.asArray().filter((ref) => {
    const dict = doc.context.lookup(ref);

    return (
      dict instanceof PDFDict &&
      dict.get(PDFName.of("Subtype")) === PDFName.of("Widget")
    );
  });

  if (kept.length !== annots.size()) {
    droppedAnnots += annots.size() - kept.length;
    page.node.set(PDFName.of("Annots"), doc.context.obj(kept));
  }
}

const problems = [];
const seen = new Set();

for (const field of FIELDS) {
  if (seen.has(field.name)) {
    problems.push(`duplicate field name: "${field.name}"`);
    continue;
  }
  seen.add(field.name);

  const page = pages[field.page - 1];

  if (!page) {
    problems.push(`"${field.name}": page ${field.page} does not exist`);
    continue;
  }

  const { width, height } = page.getMediaBox();
  const onPage = (r) =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= width + 1 && r.y + r.h <= height + 1;

  for (const r of field.options ? field.options.map((o) => o.rect) : [field.rect]) {
    if (!onPage(r)) {
      problems.push(
        `"${field.name}": rect {${r.x}, ${r.y}, ${r.w}, ${r.h}} falls outside page ${field.page}`,
      );
    }
  }
  if (problems.length) continue;

  if (field.type === "choices") {
    // ONE field, one widget per option. pdf-lib hardcodes the on-state to /Yes
    // in addToPage, so each widget's appearance is restated under its real
    // export value afterwards — that is what `selectWidget` matches on, in both
    // the client stamper and the backend filler.
    const group = form.createCheckBox(field.name);

    for (const option of field.options) {
      const { x, y, w, h } = option.rect;

      group.addToPage(page, {
        x,
        y,
        width: w,
        height: h,
        borderWidth: 0,
        backgroundColor: undefined,
        borderColor: undefined,
      });

      const widget = group.acroField.getWidgets().at(-1);

      group.updateWidgetAppearance(widget, PDFName.of(option.on));
      widget.dict.set(PDFName.of("AS"), PDFName.of("Off"));
    }
    group.acroField.setDefaultAppearance("/ZaDb 0 Tf 0 g");
    continue;
  }

  const { x, y, w, h } = field.rect;

  if (field.type === "checkbox") {
    const box = form.createCheckBox(field.name);

    box.addToPage(page, {
      x,
      y,
      width: w,
      height: h,
      // The printed square is already on the page; ours must not double it up.
      borderWidth: 0,
      backgroundColor: undefined,
      borderColor: undefined,
    });

    // pdf-lib names the "on" state /Yes. The DS-11 convention is that the export
    // value IS the schema's option id, so rename the appearance state to match.
    if (field.on && field.on !== "Yes") {
      for (const widget of box.acroField.getWidgets()) {
        const ap = widget.getAppearances();
        const normal = ap?.normal;

        if (normal && normal instanceof Object && "keys" in normal) {
          const yes = normal.get(PDFName.of("Yes"));

          if (yes) {
            normal.set(PDFName.of(field.on), yes);
            normal.delete(PDFName.of("Yes"));
          }
        }
        if (widget.dict.get(PDFName.of("AS"))?.toString() === "/Yes") {
          widget.dict.set(PDFName.of("AS"), PDFName.of("Off"));
        }
      }
    }
    continue;
  }

  const text = form.createTextField(field.name);

  text.addToPage(page, {
    x,
    y,
    width: w,
    height: h,
    borderWidth: 0,
    backgroundColor: undefined,
    borderColor: undefined,
    textColor: rgb(0, 0, 0),
    // A fixed size, not 0/auto. Auto-size scales each field's text to its own
    // box height, so the taller boxes rendered visibly larger than the shorter
    // ones and the filled form looked ragged. The boxes turn out to vary far
    // less than that choice assumed — every one is 16.5-20.0pt tall — so one
    // size serves all of them.
    size: FIELD_FONT_SIZE,
  });

  // `addToPage` writes a /DA carrying whatever size it just laid out with. It
  // happens to agree with us now, but restating it keeps the size in one place
  // and survives any future change to how addToPage picks a size. /Helv
  // resolves against the AcroForm /DR the source already ships.
  text.acroField.setDefaultAppearance(`/Helv ${FIELD_FONT_SIZE} Tf 0 g`);

  if (field.cells) {
    // A comb field prints one character per cell. /MaxLen is required for comb
    // to render at all, and the cell count IS the max length.
    text.setMaxLength(field.cells);
    text.acroField.dict.set(
      PDFName.of("Ff"),
      doc.context.obj(text.acroField.getFlags() | (1 << 24)),
    );
  }
  if (field.multiline) text.enableMultiline();
}

if (problems.length) {
  console.error(`Refusing to write the template:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

// Deliberately NOT setting /NeedAppearances, matching DS-11. `addToPage`
// generates a real appearance stream for every widget, so there is nothing for
// a reader to regenerate — and the flag is honoured by Acrobat but ignored or
// half-honoured by Chrome, Edge and Preview. It would also put /AP /N out of
// reach of `PDFForm.flatten`, which the backend filler still calls.

const counts = FIELDS.reduce(
  (acc, f) => {
    const kind =
      f.type === "choices" ? "choice" : f.type === "checkbox" ? "checkbox" : f.cells ? "comb" : "text";

    acc[kind] += 1;

    return acc;
  },
  { text: 0, comb: 0, checkbox: 0, choice: 0 },
);

if (probe) {
  // Fill every field with its own name so a render shows, in one pass, whether
  // each box is in the right place and the right size.
  for (const field of FIELDS) {
    try {
      if (field.type === "choices") {
        // Tick the FIRST option only — ticking all of them would hide the very
        // thing this proves, that the group is mutually exclusive.
        form.getCheckBox(field.name).acroField.setValue(
          PDFName.of(field.options[0].on),
        );
        continue;
      }
      if (field.type === "checkbox") {
        form.getCheckBox(field.name).check();
        continue;
      }
      // Truncate to the comb's cell count. setText throws past /MaxLen, and a
      // silent throw here reads on the render as "that box is in the wrong
      // place" when in fact it was simply never filled.
      const value = field.cells ? field.name.slice(0, field.cells) : field.name;

      form.getTextField(field.name).setText(value);
    } catch (err) {
      console.error(`  probe could not fill "${field.name}": ${err.message}`);
    }
  }
  fs.mkdirSync(path.dirname(PROBE_OUT), { recursive: true });
  // The probe exists to be looked at, so it DOES want appearance streams
  // regenerated — without them the values are present in the PDF but paint
  // nothing, and the render reads as "every box is empty". The real template
  // below must not regenerate them: it ships with empty fields, and the pass
  // would overwrite the auto-size /DA with a baked font size.
  fs.writeFileSync(PROBE_OUT, await doc.save());
  console.log(`probe written: ${path.relative(ROOT, PROBE_OUT)}`);
} else {
  fs.writeFileSync(OUT, await doc.save({ updateFieldAppearances: false }));
  console.log(`template written: ${path.relative(ROOT, OUT)}`);
}

console.log(
  `  ${FIELDS.length} fields — ${counts.text} text, ${counts.comb} comb, ${counts.choice} choice groups, ${counts.checkbox} checkbox`,
);
