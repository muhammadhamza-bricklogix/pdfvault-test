import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";

/**
 * Client-schema field id → backend DTO field name(s).
 *
 * Our schema uses W-9 AcroForm-derived ids like `c1_1`; the finalize
 * endpoint has an explicit DTO with human-readable field names. Fields
 * NOT listed here are passed through under their original id (the
 * backend accepts the pdfRef-style keys for the free-text fields).
 *
 * Discovered by iterating on 422 responses + observing the stamped PDF:
 *   - `c1_1` → `classification`
 *   - `signature_date` → BOTH `date` AND `signature_date` (backend
 *     validator requires `date` but the stamper keys off `signature_date`)
 */
const SCHEMA_ID_TO_BACKEND_FIELDS: Record<string, readonly string[]> = {
  c1_1: ["classification"],
  signature_date: ["date", "signature_date"],
};

/**
 * Radio-option value mapping for the federal tax classification. Our
 * schema uses hyphenated ids; the backend DTO enum uses underscores.
 */
const CLASSIFICATION_VALUE_MAP: Record<string, string> = {
  individual: "individual",
  "c-corp": "c_corp",
  "s-corp": "s_corp",
  partnership: "partnership",
  "trust-estate": "trust_estate",
  llc: "llc",
  other: "other",
};

/**
 * Normalize the form-fill values map into the shape the backend
 * `/form-sessions/:id/finalize` endpoint accepts. Shared by:
 *   - `W9FinalizeIntercept` (Download → finalize + download stamped PDF)
 *   - `ShareModal` on the /w-9-form route (Share → finalize then upload
 *     the stamped bytes to /api/share/create instead of the blank
 *     template)
 *
 * Both callers MUST use this helper so the backend receives an
 * identical payload shape. Duplicating the normalize logic risks the
 * two paths drifting — Share would ship a differently-stamped PDF than
 * Download for the same inputs.
 *
 * Adjustments the backend has flagged with 422 on the raw store payload:
 *
 *   1. **Field renames** — see `SCHEMA_ID_TO_BACKEND_FIELDS`.
 *   2. **Value enum mapping** — `classification` values underscored.
 *   3. **Date format** — MM/DD/YYYY (DateField display shape).
 *   4. **SSN / EIN** — strip hyphens (`@Matches(/^\d{9}$/)`).
 *   5. **Empty strings** — dropped.
 */
export function normalizeW9ValuesForFinalize(
  values: Record<string, string>,
): Record<string, string> {
  const fields = W9_SCHEMA.sections.flatMap((s) => s.fields);
  const digitsOnlyFieldIds = new Set(
    fields.filter((f) => f.type === "ssn" || f.type === "ein").map((f) => f.id),
  );
  const out: Record<string, string> = {};

  for (const [id, rawValue] of Object.entries(values)) {
    if (rawValue == null || rawValue === "") continue;

    let value = rawValue;

    if (digitsOnlyFieldIds.has(id)) {
      value = rawValue.replace(/\D/g, "");
      if (!value) continue;
    }

    if (id === "c1_1") {
      value = CLASSIFICATION_VALUE_MAP[rawValue] ?? rawValue;
    }

    const aliases = SCHEMA_ID_TO_BACKEND_FIELDS[id] ?? [id];

    for (const outKey of aliases) {
      out[outKey] = value;
    }
  }

  return out;
}
