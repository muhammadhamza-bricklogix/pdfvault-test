#!/usr/bin/env node
/**
 * Dumps every AcroForm field in public/static/forms/fw9.pdf to
 * schemas/w9-raw-fields.json.
 *
 * Output shape:
 *   [
 *     {
 *       name: string,
 *       type: "PDFTextField" | "PDFCheckBox" | "PDFRadioGroup" | "PDFDropdown" | "PDFOptionList" | "PDFButton" | "PDFSignature" | ...,
 *       options?: string[],
 *       rects: [{ page: number, x: number, y: number, width: number, height: number }]
 *     },
 *     ...
 *   ]
 *
 * `page` is 1-indexed; coordinates are in PDF user-space points
 * (origin = bottom-left).
 */
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_PATH = path.join(ROOT, "public/static/forms/fw9.pdf");
const OUT_PATH = path.join(ROOT, "schemas/w9-raw-fields.json");

const bytes = fs.readFileSync(PDF_PATH);
const pdf = await PDFDocument.load(bytes);
const form = pdf.getForm();
const pages = pdf.getPages();

// Build a map from widget annotation dict (the same PDFDict instance cached
// in PDFContext.indirectObjects) → 1-indexed page number. pdf-lib doesn't
// expose `widget.ref`, so we use dict identity instead.
const dictToPage = new Map();

for (let i = 0; i < pages.length; i++) {
  const annots = pages[i].node.Annots();

  if (!annots) continue;

  for (let j = 0; j < annots.size(); j++) {
    const ref = annots.get(j);
    const dict = ref ? pdf.context.lookup(ref) : null;

    if (dict) dictToPage.set(dict, i + 1);
  }
}

const fields = form.getFields();
const out = fields.map((field) => {
  const name = field.getName();
  const type = field.constructor.name;
  const entry = { name, type, rects: [] };

  // Options-bearing field types.
  if (typeof field.getOptions === "function") {
    try {
      entry.options = field.getOptions();
    } catch {
      // Some fields advertise getOptions but throw if the dict is malformed.
    }
  }

  const widgets =
    typeof field.acroField.getWidgets === "function"
      ? field.acroField.getWidgets()
      : [];

  for (const widget of widgets) {
    const pageNum = dictToPage.get(widget.dict) ?? null;
    const rect = widget.getRectangle();

    entry.rects.push({
      page: pageNum,
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
    });
  }

  return entry;
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");

const widgetCount = out.reduce((n, f) => n + f.rects.length, 0);

console.log(
  `Wrote ${out.length} fields (${widgetCount} widgets) → ${path.relative(ROOT, OUT_PATH)}`,
);

function round(n) {
  return Math.round(n * 100) / 100;
}
