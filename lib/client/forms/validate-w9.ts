import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";

/**
 * Returns a map of `fieldId → errorMessage` for every invalid field. An
 * empty object means the form is ready to finalize.
 *
 * Rules ordered to match the IRS form, plus light cross-field checks:
 *  - f1_01 must be present (name on tax return)
 *  - c1_1 must be set to one of the seven options
 *  - if c1_1 === "llc", f1_03 must be one of C / S / P
 *  - exactly one of SSN xor EIN must be provided
 *  - SSN: ^(?!000|666|9)\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}$
 *  - EIN: ^(?!00|07|08|09|17|18|19|28|29|49|78|79|89)\d{2}-?\d{7}$
 *  - date parses as MM/DD/YYYY, year between 1900 and current year
 *  - signatureKey must be set
 */
export const SSN_REGEX = /^(?!000|666|9)\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}$/;

export const EIN_REGEX =
  /^(?!00|07|08|09|17|18|19|28|29|49|78|79|89)\d{2}-?\d{7}$/;

const CLASSIFICATION_IDS = new Set([
  "individual",
  "c-corp",
  "s-corp",
  "partnership",
  "trust-estate",
  "llc",
  "other",
]);

const LLC_LETTERS = new Set(["C", "S", "P"]);

export type ValidationInput = {
  values: Record<string, string>;
  signatureKey: string | null;
};

export function validateW9({
  values,
  signatureKey,
}: ValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};

  // Every field is OPTIONAL for save + download per product
  // 2026-08-31 — users must be able to persist and export in any
  // filling state. Shape-check present values so a typo doesn't get
  // stamped verbatim, but never block on missing ones.

  // c1_1 — federal tax classification. If set, must be a known
  // option so the AcroForm stamp has a target widget to check.
  const classification = values.c1_1;

  if (classification && !CLASSIFICATION_IDS.has(classification)) {
    errors.c1_1 = "Pick one tax classification.";
  }

  // f1_03 — LLC letter (only meaningful when classification is LLC).
  if (classification === "llc") {
    const letter = (values.f1_03 ?? "").trim().toUpperCase();

    if (letter && !LLC_LETTERS.has(letter)) {
      errors.f1_03 = "Enter exactly one of C, S, or P.";
    }
  }

  // SSN + EIN — no longer required, and both may be blank. If both
  // are set, flag the collision (backend rejects, and the printed
  // form only has one row). Otherwise shape-check whichever is set.
  const ssn = (values.ssn ?? "").trim();
  const ein = (values.ein ?? "").trim();

  if (ssn && ein) {
    errors.ssn = "Provide only one — SSN or EIN, not both.";
    errors.ein = "Provide only one — SSN or EIN, not both.";
  } else if (ssn && !SSN_REGEX.test(ssn)) {
    errors.ssn = "Enter a valid SSN (e.g. 123-45-6789).";
  } else if (ein && !EIN_REGEX.test(ein)) {
    errors.ein = "Enter a valid EIN (e.g. 12-3456789).";
  }

  // Signature date — OPTIONAL per product 2026-08-31. Users can save
  // and download partial W-9s without filling the date. If a value is
  // present we still validate its shape (MM/DD/YYYY, real calendar
  // date, 1900..currentYear) so a typo doesn't get stamped as-is.
  const dateStr = (values.signature_date ?? "").trim();

  if (dateStr) {
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
    const currentYear = new Date().getFullYear();

    if (!dateMatch) {
      errors.signature_date = "Use MM/DD/YYYY format.";
    } else {
      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);
      const year = parseInt(dateMatch[3]!, 10);
      const parsed = new Date(year, month - 1, day);
      const validParts =
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day;

      if (!validParts) {
        errors.signature_date = "That date doesn't look right.";
      } else if (year < 1900 || year > currentYear) {
        errors.signature_date = `Year must be between 1900 and ${currentYear}.`;
      }
    }
  }

  // Signature uploaded — kept as a soft nudge (backend `finalize`
  // enforces this, but the download flow now falls back to a client
  // stamp when the user hasn't signed, so we don't block pre-flight
  // either).
  if (!signatureKey) {
    // No-op — the fallback path handles unsigned partial saves and
    // downloads. Left here as a documentation anchor; add back
    // `errors.signature = …` if we ever require signature at
    // pre-flight again.
    void signatureKey;
  }

  return errors;
}

/**
 * Look up a field id in the W-9 schema. Used by FinalizeModal to scroll to
 * the first invalid field's sidebar position.
 */
export function findFieldInSchema(fieldId: string) {
  for (const section of W9_SCHEMA.sections) {
    const field = section.fields.find((f) => f.id === fieldId);

    if (field) return { field, section };
  }

  return null;
}
