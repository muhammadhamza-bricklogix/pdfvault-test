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

  // f1_01 — name on tax return
  if (!values.f1_01 || values.f1_01.trim().length === 0) {
    errors.f1_01 = "Enter the name shown on your tax return.";
  }

  // c1_1 — federal tax classification
  const classification = values.c1_1;

  if (!classification || !CLASSIFICATION_IDS.has(classification)) {
    errors.c1_1 = "Pick one tax classification.";
  }

  // f1_03 — LLC letter (only when c1_1 === "llc")
  if (classification === "llc") {
    const letter = (values.f1_03 ?? "").trim().toUpperCase();

    if (!letter) {
      errors.f1_03 = "Enter C, S, or P for the LLC classification.";
    } else if (!LLC_LETTERS.has(letter)) {
      errors.f1_03 = "Enter exactly one of C, S, or P.";
    }
  }

  // SSN xor EIN
  const ssn = (values.ssn ?? "").trim();
  const ein = (values.ein ?? "").trim();

  if (!ssn && !ein) {
    errors.ssn = "Enter your SSN or EIN.";
    errors.ein = "Enter your SSN or EIN.";
  } else if (ssn && ein) {
    errors.ssn = "Provide only one — SSN or EIN, not both.";
    errors.ein = "Provide only one — SSN or EIN, not both.";
  } else if (ssn && !SSN_REGEX.test(ssn)) {
    errors.ssn = "Enter a valid SSN (e.g. 123-45-6789).";
  } else if (ein && !EIN_REGEX.test(ein)) {
    errors.ein = "Enter a valid EIN (e.g. 12-3456789).";
  }

  // Signature date — MM/DD/YYYY with 1900..currentYear range
  const dateStr = (values.signature_date ?? "").trim();
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  const currentYear = new Date().getFullYear();

  if (!dateStr) {
    errors.signature_date = "Pick a date.";
  } else if (!dateMatch) {
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

  // Signature uploaded
  if (!signatureKey) {
    errors.signature = "Sign before submitting.";
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
