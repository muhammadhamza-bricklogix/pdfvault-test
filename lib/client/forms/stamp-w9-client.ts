import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";
import { ROUTES } from "@/lib/shared/constants/routes";

/**
 * Client-side fallback stamper for the W-9. Uses pdf-lib to fill the
 * blank IRS template with whatever values the user has typed, tick
 * the selected classification checkbox, and draw the local signature
 * preview if present.
 *
 * Why this exists:
 *   Server `finalizeFormSession` enforces strict validators (SSN xor
 *   EIN, MM/DD/YYYY date required, non-empty signatureKey, etc.).
 *   Users on `/w-9-form` have explicitly asked to be able to download
 *   a partially-filled form — even with no signature, no date, and
 *   most fields blank. This helper produces a stamped PDF client-side
 *   so those downloads succeed regardless of backend validation.
 *
 * Trade-off:
 *   No paywall gate here — callers must apply their own before
 *   invoking. Currently `W9FinalizeIntercept` handles that upstream.
 *
 * Not a full replacement for server finalize:
 *   - No exempt-payee AcroForm dropdowns (rare, ignored)
 *   - No form-flattening (the AcroForm remains editable in some
 *     readers). Acceptable for a "quick partial download" flow.
 */
export async function stampW9Client(
  values: Record<string, string>,
  signaturePreview: string | null,
): Promise<Uint8Array> {
  // Fetch the blank IRS template. `force-cache` matches W9EditorBootstrap
  // so the template is served from the browser cache after the first
  // load.
  const res = await fetch(ROUTES.STATIC.W9_BLANK_PDF, { cache: "force-cache" });

  if (!res.ok) {
    throw new Error(`Failed to load W-9 template (HTTP ${res.status})`);
  }
  const templateBytes = new Uint8Array(await res.arrayBuffer());

  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Text fields (name, address, TIN segments, LLC letter, other-desc,
  // account numbers, exempt codes). Missing / empty values are
  // skipped — no placeholder stamping.
  const setTextIfPossible = (pdfRef: string, value: string) => {
    if (!value) return;
    try {
      form.getTextField(pdfRef).setText(value);
    } catch {
      // Some rects on the schema (e.g. SSN/EIN parent) don't map to a
      // single AcroForm text widget; segment children are what the
      // template actually exposes. Silently ignore — the segment
      // walk below covers those.
    }
  };

  // Classification checkboxes — schema stores selected option id;
  // widgets are `c1_1[0..6]` in the same order as the schema options.
  const classificationOptions = W9_SCHEMA.sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === "c1_1")?.options;

  if (classificationOptions && values.c1_1) {
    const idx = classificationOptions.findIndex((o) => o.id === values.c1_1);

    if (idx >= 0) {
      try {
        form
          .getCheckBox(
            `topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[${idx}]`,
          )
          .check();
      } catch {
        /* silent */
      }
    }
  }

  // 3b partnership-with-foreign-partners checkbox
  if (values.c1_2 === "true" || values.c1_2 === "on") {
    try {
      form
        .getCheckBox(
          "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_2[0]",
        )
        .check();
    } catch {
      /* silent */
    }
  }

  // Walk every schema field and try to set text on its pdfRef. SSN /
  // EIN parent refs will fail (they're rendered per-segment) — the
  // segments loop below handles them.
  const fields = W9_SCHEMA.sections.flatMap((s) => s.fields);

  for (const field of fields) {
    if (field.type === "radio" || field.type === "checkbox") continue;
    if (field.type === "signature") continue;
    const value = values[field.id];

    if (!value) continue;

    if (field.type === "ssn" || field.type === "ein") {
      // Digits only, split across per-segment AcroForm widgets. Widget
      // names for SSN: f1_11[0], f1_12[0], f1_13[0]. EIN: f1_14[0],
      // f1_15[0]. Derive by splitting the parent `f1_11_12_13[0]` /
      // `f1_14_15[0]` name.
      const digits = value.replace(/\D/g, "");

      if (!digits) continue;
      const parentName = field.pdfRef;
      const segmentNames = extractSegmentFieldNames(parentName);
      const segments = field.segments ?? [];
      let offset = 0;

      for (let i = 0; i < segments.length; i++) {
        const segLen = segments[i]!.length;
        const chunk = digits.slice(offset, offset + segLen);

        offset += segLen;
        const name = segmentNames[i];

        if (chunk && name) setTextIfPossible(name, chunk);
      }
      continue;
    }

    setTextIfPossible(field.pdfRef, value);
  }

  // Signature — draw the local preview data URL if present. No
  // AcroForm widget for this on the W-9 template, so we stamp
  // directly on the page at the schema-defined rect.
  if (signaturePreview) {
    const signatureField = fields.find((f) => f.id === "signature");

    if (signatureField) {
      try {
        const imgBytes = dataUrlToUint8Array(signaturePreview);

        if (imgBytes) {
          // Preview is always exported as PNG by SignatureModal.
          const embedded = await pdfDoc.embedPng(imgBytes);
          const page = pdfDoc.getPage(signatureField.rect.page - 1);
          const rect = signatureField.rect;
          // pdf-lib uses PDF user space (origin bottom-left), matching
          // the schema rects directly. Scale image to fit the rect
          // preserving aspect ratio, anchored bottom-left.
          const scale = Math.min(
            rect.w / embedded.width,
            rect.h / embedded.height,
          );
          const drawWidth = embedded.width * scale;
          const drawHeight = embedded.height * scale;

          page.drawImage(embedded, {
            x: rect.x,
            y: rect.y,
            width: drawWidth,
            height: drawHeight,
          });
        }
      } catch {
        /* silent — partial download shouldn't be blocked by a bad preview */
      }
    }
  }

  return pdfDoc.save();
}

/**
 * SSN parent widget is named `f1_11_12_13[0]`; segment widgets are
 * `f1_11[0]`, `f1_12[0]`, `f1_13[0]`. Same shape for EIN
 * `f1_14_15[0]` → `f1_14[0]`, `f1_15[0]`. Derive per-segment names by
 * splitting the numeric run in the parent.
 */
function extractSegmentFieldNames(parentPdfRef: string): string[] {
  // Match trailing `f<num>_<num>_<num>...[<n>]` — grab prefix + list.
  const match = /^(.*)f(\d+(?:_\d+)+)\[(\d+)\]$/.exec(parentPdfRef);

  if (!match) return [];
  const prefix = match[1];
  const nums = match[2]!.split("_");
  const bracket = match[3];

  return nums.map((n) => `${prefix}f${n}[${bracket}]`);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const match = /^data:[^;]+;base64,(.*)$/.exec(dataUrl);

  if (!match) return null;
  const bin = atob(match[1]!);
  const bytes = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  return bytes;
}
