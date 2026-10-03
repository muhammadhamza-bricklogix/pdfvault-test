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

  for (const field of fields) {
    const raw = values[field.id];

    if (!raw) continue;

    // Drawn after the loop: there is no widget to write into.
    if (field.freeText) continue;

    if (field.type === "checkbox") {
      if (!isChecked(raw)) continue;
      try {
        form.getCheckBox(field.pdfRef).check();
      } catch {
        /* widget absent on this copy — skip */
      }
      continue;
    }

    try {
      form.getTextField(field.pdfRef).setText(formatValue(field.id, raw));
    } catch {
      /* not a text widget — skip */
    }
  }

  form.flatten();

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
