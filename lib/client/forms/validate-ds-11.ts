import type { FormField } from "@/lib/shared/types/forms.types";

import { DS_11_SCHEMA } from "@/lib/client/forms/ds-11-schema";

export type Ds11ValidationInput = {
  values: Record<string, string>;
};

const ALL_FIELDS: FormField[] = DS_11_SCHEMA.sections.flatMap((s) => s.fields);

const BY_ID = new Map(ALL_FIELDS.map((f) => [f.id, f]));

const DATE_PATTERN = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/;

/** Item 18 tells the applicant to write "none" when they have no travel plans. */
const NO_TRAVEL = new Set(["none", "n/a", "na"]);

const DATE_FIELDS = [
  "parent1_dob",
  "parent2_dob",
  "spouse_dob",
  "marriage_date",
  "widow_divorce_date",
  "travel_departure",
  "travel_return",
];

const STATE_FIELDS = ["mailing_state", "permanent_state", "emergency_state"];

const SSN_PARTS = [
  { id: "ssn_1", length: 3 },
  { id: "ssn_2", length: 2 },
  { id: "ssn_3", length: 4 },
];

const PHONE_PARTS = [
  { id: "phone_1", length: 3 },
  { id: "phone_2", length: 3 },
  { id: "phone_3", length: 4 },
];

/**
 * The PDF embeds Helvetica and encodes with WinAnsi, which covers Latin-1 but
 * nothing beyond it. These are the few code points above U+00FF it carries.
 * Mirrors the same guard in the backend filler.
 */
const WINANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const EXPANDING_WHITESPACE = new RegExp(
  "[\\t\\n\\f\\r\\v\\u0085\\u2028\\u2029]+",
  "g",
);

const read = (values: Record<string, string>, id: string): string =>
  (values[id] ?? "").trim();

/**
 * Collapses the whitespace pdf-lib expands into four spaces when it lays out a
 * comb field, so the length checked here is the length it will actually draw.
 */
const normalize = (raw: string): string =>
  raw.replace(EXPANDING_WHITESPACE, " ").replace(/ {2,}/g, " ").trim();

const isWholeNumberInRange = (raw: string, low: number, high: number) =>
  /^\d+$/.test(raw) && Number(raw) >= low && Number(raw) <= high;

function checkRequired(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  for (const field of ALL_FIELDS) {
    if (!field.required) continue;
    if (read(values, field.id)) continue;
    errors[field.id] = `${field.label} is required.`;
  }
}

/**
 * The 1099-NEC silently clipped "California" to "Ca". Here an entry that will
 * not fit its printed boxes is refused with the limit named.
 */
function checkLengths(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  for (const field of ALL_FIELDS) {
    if (typeof field.maxLength !== "number") continue;
    const raw = normalize(read(values, field.id));

    if (raw && raw.length > field.maxLength) {
      errors[field.id] =
        `${field.label} must be ${field.maxLength} characters or fewer — that is all the form prints.`;
    }
  }
}

function checkChoices(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  for (const field of ALL_FIELDS) {
    if (field.type !== "radio" || !field.options) continue;
    const raw = read(values, field.id);

    if (!raw) continue;
    if (field.options.some((o) => o.id === raw)) continue;
    errors[field.id] = `Choose one of the ${field.label} options.`;
  }
}

/**
 * Judged on what was typed rather than on the digits left after stripping, so
 * "ab" in the month box is reported as wrong instead of read as an empty box.
 */
function checkDateOfBirth(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  const month = read(values, "dob_month");
  const day = read(values, "dob_day");
  const year = read(values, "dob_year");
  const currentYear = new Date().getFullYear();

  if (month && !isWholeNumberInRange(month, 1, 12)) {
    errors.dob_month = "Month must be a number between 01 and 12.";
  }
  if (day && !isWholeNumberInRange(day, 1, 31)) {
    errors.dob_day = "Day must be a number between 01 and 31.";
  }
  if (year && !isWholeNumberInRange(year, 1900, currentYear)) {
    errors.dob_year = `Year must be a 4-digit year between 1900 and ${currentYear}.`;
  }
}

function checkSplitNumber(
  values: Record<string, string>,
  errors: Record<string, string>,
  parts: { id: string; length: number }[],
  label: string,
) {
  const raw = parts.map(({ id }) => read(values, id));

  if (raw.every((value) => value === "")) return;

  for (const [index, part] of parts.entries()) {
    const value = raw[index] ?? "";
    const expected = new RegExp(`^[0-9]{${part.length}}$`);

    if (!expected.test(value)) {
      errors[part.id] = `${label} needs exactly ${part.length} digits here.`;
    }
  }
}

function checkDates(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  for (const id of DATE_FIELDS) {
    const raw = read(values, id);

    if (!raw) continue;
    if (id.startsWith("travel_") && NO_TRAVEL.has(raw.toLowerCase())) continue;
    if (DATE_PATTERN.test(raw)) continue;
    errors[id] = `${BY_ID.get(id)?.label ?? id} must look like MM/DD/YYYY.`;
  }
}

function checkStates(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  for (const id of STATE_FIELDS) {
    const raw = read(values, id);

    if (raw && !/^[A-Za-z]{2}$/.test(raw)) {
      errors[id] = "Use the 2-letter state code, for example CO.";
    }
  }
}

function firstUnprintable(raw: string): string | null {
  for (const char of raw) {
    const codePoint = char.codePointAt(0);

    if (codePoint === undefined) continue;
    if (codePoint <= 0xff || WINANSI_EXTRAS.has(codePoint)) continue;

    return char;
  }

  return null;
}

function checkPrintable(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  for (const field of ALL_FIELDS) {
    if (field.type === "radio") continue;
    const offending = firstUnprintable(read(values, field.id));

    if (offending) {
      errors[field.id] =
        `The form cannot print "${offending}". Use the Latin alphabet — the State Department requires it.`;
    }
  }
}

function checkEmail(
  values: Record<string, string>,
  errors: Record<string, string>,
) {
  const email = read(values, "email");

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
}

export function validateDs11({
  values,
}: Ds11ValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};

  checkRequired(values, errors);
  checkLengths(values, errors);
  checkChoices(values, errors);
  checkDateOfBirth(values, errors);
  checkSplitNumber(values, errors, SSN_PARTS, "Social Security Number");
  checkSplitNumber(values, errors, PHONE_PARTS, "Phone number");
  checkDates(values, errors);
  checkStates(values, errors);
  checkPrintable(values, errors);
  checkEmail(values, errors);

  return errors;
}
