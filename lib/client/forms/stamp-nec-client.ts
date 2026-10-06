import type { FormField } from "@/lib/shared/types/forms.types";
import type { PDFDocument, PDFForm } from "pdf-lib";

import { NEC_1099_SCHEMA } from "@/lib/client/forms/1099-nec-schema";
import { ROUTES } from "@/lib/shared/constants/routes";

const COPY_A_PAGE_INDEX = 1;

/** Copy A, Copy 1, Copy B, Copy 2 — pages 2, 3, 4 and 6, zero-indexed. */
const COPY_PAGE_INDEXES = [1, 2, 3, 5];

const CURRENCY_FIELDS = new Set([
  "box1_nec",
  "box1b_cash_tips",
  "box1d_overtime",
  "box3_excess_golden",
  "box4_fed_tax_withheld",
  "box5_state_tax_1",
  "box5_state_tax_2",
  "box7_state_income_1",
  "box7_state_income_2",
]);

const TIN_FIELDS = new Set(["payer_tin", "recipient_tin"]);

function formatCurrency(raw: string): string {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const num = Number.parseFloat(cleaned);

  if (Number.isNaN(num)) return raw;

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTin(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 9) return raw;
  if (raw.includes("-")) return raw;

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function formatValue(fieldId: string, raw: string): string {
  if (CURRENCY_FIELDS.has(fieldId)) return formatCurrency(raw);
  if (TIN_FIELDS.has(fieldId)) return formatTin(raw);

  return raw;
}

function isChecked(raw: string | undefined): boolean {
  return raw === "true" || raw === "on" || raw === "1";
}

/**
 * Every value belongs on all four copies, but the schema only carries the
 * Copy A `pdfRef`. The IRS names the same widget identically across copies
 * apart from the subform it hangs off — `CopyA[0].LeftCol[0].f1_2[0]` is
 * `Copy1[0].LeftCol[0].f2_2[0]`, `CopyB[0]...f2_2[0]`, `Copy2[0]...f2_2[0]`.
 * The `f<n>_` digit tracks the XFA page, NOT the copy (B and 2 both use
 * `f2_`), so the only stable identity is the trailing `<kind><slot>[widget]`
 * plus the copy subform. Resolved from the loaded document rather than a
 * hardcoded table so it cannot drift from the asset.
 *
 * Four widgets legitimately exist on Copy A only (the second-TIN notice, and
 * CORRECTED on Copy B) — those simply resolve to fewer targets.
 */
const COPY_SUBFORMS = ["CopyA", "Copy1", "CopyB", "Copy2"] as const;

function widgetKey(ref: string): string | null {
  const terminal = ref.split(".").pop() ?? "";
  const m = terminal.match(/^([fc])\d+_(\d+)\[(\d+)\]$/);

  return m ? `${m[1]}|${m[2]}|${m[3]}` : null;
}

function copySubform(ref: string): string | null {
  return (
    ref.match(/topmostSubform\[0\]\.(CopyA|Copy1|CopyB|Copy2)\[0\]/)?.[1] ??
    null
  );
}

function buildCopyRefIndex(form: {
  getFields: () => { getName: () => string }[];
}): (ref: string) => string[] {
  const index = new Map<string, string>();

  for (const field of form.getFields()) {
    const name = field.getName();
    const copy = copySubform(name);
    const key = widgetKey(name);

    if (copy && key) index.set(`${copy}|${key}`, name);
  }

  return (ref) => {
    const key = widgetKey(ref);

    if (!key) return [ref];

    const refs = COPY_SUBFORMS.map((copy) =>
      index.get(`${copy}|${key}`),
    ).filter((name): name is string => !!name);

    return refs.length > 0 ? refs : [ref];
  };
}

/**
 * Leave the downloaded PDF editable, but make Copy A the only place to type.
 *
 * Product decision 2026-10-04, reversing the earlier "downloads are flattened
 * and read-only" rule: the recipient should be able to correct the form in
 * their reader. The 1099-NEC prints the same data four times, so every value is
 * stamped onto all four copies in the loop above, and then the three carbon
 * copies are locked and given a calculate action that reads Copy A's value.
 *
 * IMPORTANT, and the reason the values are stamped onto every copy first:
 * calculate actions are PDF JavaScript. Acrobat and Reader run them, so there
 * editing Copy A updates Copy 1, Copy B and Copy 2 live. Chrome, Edge, Firefox
 * and macOS Preview ignore PDF JavaScript entirely — in those viewers the
 * carbon copies keep the values stamped at download time and stay read-only,
 * rather than appearing blank.
 */
async function lockCarbonCopiesToCopyA(
  pdfDoc: PDFDocument,
  form: PDFForm,
  copyRefs: (ref: string) => string[],
  fields: FormField[],
): Promise<void> {
  const { PDFDict, PDFName, PDFNumber, PDFString } = await import("pdf-lib");
  /** Bit 1 of /Ff. A field flag, not a widget flag — see the note above. */
  const READ_ONLY = 1;
  const calculationOrder = [];

  for (const field of fields) {
    // No widget to lock; drawn onto the page further down.
    if (field.freeText) continue;

    const refs = copyRefs(field.pdfRef);
    const master = refs.find((ref) => copySubform(ref) === "CopyA");

    if (!master) continue;

    // The IRS ships Copy A with every field flagged ReadOnly — it is the
    // scannable copy meant to be filed, not typed into. Our download is a
    // working document rather than a filing, and Copy A is the master the
    // other three read from, so it has to be unlocked explicitly.
    try {
      const masterDict = form.getField(master).acroField.dict;
      const masterFf = masterDict.lookup(PDFName.of("Ff"));
      const masterFlags =
        masterFf instanceof PDFNumber ? masterFf.asNumber() : 0;

      masterDict.set(PDFName.of("Ff"), PDFNumber.of(masterFlags & ~READ_ONLY));
    } catch {
      /* master widget absent on this field — nothing to unlock */
    }

    for (const ref of refs) {
      if (ref === master) continue;

      let target;

      try {
        target = form.getField(ref);
      } catch {
        continue; // widget absent on this copy
      }

      const dict = target.acroField.dict;
      const existing = dict.lookup(PDFName.of("Ff"));
      const flags = existing instanceof PDFNumber ? existing.asNumber() : 0;

      dict.set(PDFName.of("Ff"), PDFNumber.of(flags | READ_ONLY));
      dict.set(
        PDFName.of("AA"),
        pdfDoc.context.obj({
          C: {
            S: PDFName.of("JavaScript"),
            JS: PDFString.of(
              `event.value = this.getField(${JSON.stringify(master)}).value;`,
            ),
          },
        }),
      );
      calculationOrder.push(target.ref);
    }
  }

  if (calculationOrder.length === 0) return;

  // Acrobat only runs calculate actions for fields listed in /CO, in order.
  const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"), PDFDict);

  acroForm.set(PDFName.of("CO"), pdfDoc.context.obj(calculationOrder));
}

async function stampNec(
  values: Record<string, string>,
  { singlePage }: { singlePage: boolean },
): Promise<Uint8Array> {
  const res = await fetch(ROUTES.STATIC.NEC_1099_BLANK_PDF, {
    cache: "force-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to load 1099-NEC template (HTTP ${res.status})`);
  }
  const templateBytes = new Uint8Array(await res.arrayBuffer());

  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  const fields = NEC_1099_SCHEMA.sections.flatMap((s) => s.fields);

  const copyRefs = buildCopyRefIndex(form);

  for (const field of fields) {
    const raw = values[field.id];

    if (!raw) continue;

    // Drawn after the loop: there is no widget to write into.
    if (field.freeText) continue;

    if (field.type === "checkbox") {
      if (!isChecked(raw)) continue;
      for (const ref of copyRefs(field.pdfRef)) {
        try {
          form.getCheckBox(ref).check();
        } catch {
          /* widget absent on this copy — skip */
        }
      }
      continue;
    }

    const text = formatValue(field.id, raw);

    for (const ref of copyRefs(field.pdfRef)) {
      try {
        form.getTextField(ref).setText(text);
      } catch {
        /* not a text widget — skip */
      }
    }
  }

  await lockCarbonCopiesToCopyA(pdfDoc, form, copyRefs, fields);

  const freeTextFields = fields.filter((f) => f.freeText && values[f.id]);

  if (freeTextFields.length > 0) {
    const { StandardFonts, rgb } = await import("pdf-lib");
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const field of freeTextFields) {
      const size = field.overlayFontSize ?? 8;
      const pad = 2;

      for (const index of COPY_PAGE_INDEXES) {
        const page = pages[index];

        if (!page) continue;
        page.drawText(values[field.id]!, {
          x: field.rect.x + pad,
          // drawText anchors the first baseline, so start one line down.
          y: field.rect.y + field.rect.h - size - pad,
          size,
          font,
          color: rgb(0, 0, 0),
          maxWidth: field.rect.w - pad * 2,
          lineHeight: size * 1.25,
        });
      }
    }
  }

  if (!singlePage) return pdfDoc.save();

  const preview = await PDFDocument.create();
  const [copyA] = await preview.copyPages(pdfDoc, [COPY_A_PAGE_INDEX]);

  if (copyA) preview.addPage(copyA);

  return preview.save();
}

export async function stampNecPreview(
  values: Record<string, string>,
): Promise<Uint8Array> {
  return stampNec(values, { singlePage: true });
}

export async function stampNecDocument(
  values: Record<string, string>,
): Promise<Uint8Array> {
  return stampNec(values, { singlePage: false });
}
