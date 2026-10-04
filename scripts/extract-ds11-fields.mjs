#!/usr/bin/env node
/**
 * Dumps every AcroForm field in public/static/forms/ds11.pdf to
 * schemas/ds11-raw-fields.json.
 *
 * Output shape:
 *   [
 *     {
 *       name: string,
 *       type: "PDFTextField" | "PDFCheckBox" | "PDFRadioGroup" | "PDFButton" | ...,
 *       acroType: string,
 *       flags: { raw: number, names: string[] },
 *       maxLength?: number,
 *       options?: string[],
 *       widgets: [{
 *         page: number, x, y, width, height,
 *         onValue: string | null,
 *         normalAppearance: "ref" | "dict" | "none",
 *         appearanceStates?: { state: string, isRef: boolean }[]
 *       }]
 *     },
 *     ...
 *   ]
 *
 * `page` is 1-indexed; coordinates are in PDF user-space points
 * (origin = bottom-left).
 *
 * `flags`, `maxLength` and `normalAppearance` are what the filler needs:
 * Comb + maxLength decide truncation, Radio vs Pushbutton decides how a
 * /Btn field is set, and a non-ref normal appearance is what makes
 * form.flatten() throw.
 */
import { PDFDict, PDFDocument, PDFRef } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_PATH = path.join(ROOT, "public/static/forms/ds11.pdf");
const OUT_PATH = path.join(ROOT, "schemas/ds11-raw-fields.json");

const FLAG_BITS = [
  [1, "ReadOnly"],
  [2, "Required"],
  [3, "NoExport"],
  [13, "Multiline"],
  [14, "Password"],
  [15, "NoToggleToOff"],
  [16, "Radio"],
  [17, "Pushbutton"],
  [18, "Combo"],
  [19, "Edit"],
  [20, "Sort"],
  [21, "FileSelect"],
  [22, "MultiSelect"],
  [23, "DoNotSpellCheck"],
  [24, "DoNotScroll"],
  [25, "Comb"],
  [26, "RichTextOrRadiosInUnison"],
  [27, "CommitOnSelChange"],
];

const bytes = fs.readFileSync(PDF_PATH);
const pdf = await PDFDocument.load(bytes);
const form = pdf.getForm();
const pages = pdf.getPages();

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
  const entry = {
    name: field.getName(),
    type: field.constructor.name,
    acroType: field.acroField.constructor.name,
    flags: decodeFlags(field),
    widgets: [],
  };

  const maxLength = readMaxLength(field);

  if (maxLength !== null) entry.maxLength = maxLength;

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
    const rect = widget.getRectangle();

    entry.widgets.push({
      page: dictToPage.get(widget.dict) ?? null,
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
      ...describeAppearance(widget),
    });
  }

  return entry;
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");

report(out);

function decodeFlags(field) {
  let raw = 0;

  try {
    raw = field.acroField.getFlags();
  } catch {
    raw = 0;
  }

  const names = FLAG_BITS.filter(([bit]) => (raw & (1 << (bit - 1))) !== 0).map(
    ([, name]) => name,
  );

  return { raw, names };
}

function readMaxLength(field) {
  if (typeof field.getMaxLength !== "function") return null;
  try {
    return field.getMaxLength() ?? null;
  } catch {
    return null;
  }
}

function describeAppearance(widget) {
  let onValue = null;

  try {
    onValue = widget.getOnValue()?.decodeText() ?? null;
  } catch {
    onValue = null;
  }

  let normal = null;

  try {
    normal = widget.getNormalAppearance();
  } catch {
    return { onValue, normalAppearance: "none" };
  }

  if (normal instanceof PDFRef) return { onValue, normalAppearance: "ref" };

  if (normal instanceof PDFDict) {
    return {
      onValue,
      normalAppearance: "dict",
      appearanceStates: normal.entries().map(([key, value]) => ({
        state: key.decodeText(),
        isRef: value instanceof PDFRef,
      })),
    };
  }

  return { onValue, normalAppearance: "none" };
}

function report(entries) {
  const widgetCount = entries.reduce((n, f) => n + f.widgets.length, 0);

  console.log(
    `Wrote ${entries.length} fields (${widgetCount} widgets) -> ${path.relative(ROOT, OUT_PATH)}`,
  );

  const byType = {};

  entries.forEach((f) => {
    byType[f.type] = (byType[f.type] ?? 0) + 1;
  });
  console.log("\nField classes (T2 - how /Btn fields must be set):");
  Object.entries(byType).forEach(([t, n]) => console.log(`  ${t}: ${n}`));

  const pagesUsed = [
    ...new Set(entries.flatMap((f) => f.widgets.map((w) => w.page))),
  ].sort((a, b) => a - b);

  console.log(`\nPages carrying widgets: ${pagesUsed.join(", ")}`);

  const combs = entries.filter((f) => f.flags.names.includes("Comb"));

  console.log(`\nComb fields (T1 - must truncate before setText): ${combs.length}`);
  combs.forEach((f) =>
    console.log(`  ${f.name} -> maxLength ${f.maxLength ?? "UNSET"}`),
  );

  const capped = entries.filter(
    (f) => typeof f.maxLength === "number" && !f.flags.names.includes("Comb"),
  );

  console.log(`\nNon-comb fields with a maxLength: ${capped.length}`);
  capped.forEach((f) => console.log(`  ${f.name} -> ${f.maxLength}`));

  const buttons = entries.filter((f) => f.acroType.includes("Acro") && /Btn|Button|CheckBox|Radio/.test(f.acroType));

  console.log(`\n/Btn fields and their export values (T2):`);
  buttons.forEach((f) => {
    const vals = f.widgets.map((w) => w.onValue ?? "-").join(" | ");

    console.log(
      `  ${f.name}\n      class=${f.type} flags=[${f.flags.names.join(",")}] widgets=${f.widgets.length} onValues=[${vals}]`,
    );
  });

  const risky = entries.flatMap((f) =>
    f.widgets
      .map((w, i) => ({ f, w, i }))
      .filter(({ w }) => {
        if (w.normalAppearance === "ref") return false;
        if (w.normalAppearance === "none") return true;

        return (w.appearanceStates ?? []).some((s) => !s.isRef);
      }),
  );

  console.log(
    `\nWidgets whose /AP /N is not a ref (T3 - these make flatten() throw): ${risky.length}`,
  );
  risky.forEach(({ f, w, i }) =>
    console.log(
      `  ${f.name} [widget ${i}] class=${f.type} appearance=${w.normalAppearance}`,
    ),
  );
}

function round(n) {
  return Math.round(n * 100) / 100;
}
