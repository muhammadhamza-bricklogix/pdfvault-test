function isValidTin(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 9) return false;
  if (/^0{9}$/.test(digits)) return false;

  const area = digits.slice(0, 3);

  return area !== "000" && area !== "666";
}

export type NecValidationInput = {
  values: Record<string, string>;
  signatureKey?: string | null;
};

const REQUIRED_FIELDS: { id: string; label: string }[] = [
  { id: "calendar_year", label: "Calendar year" },
  { id: "payer_name", label: "Payer's name" },
  { id: "payer_tin", label: "Payer's TIN" },
  { id: "recipient_name", label: "Recipient's name" },
  { id: "recipient_tin", label: "Recipient's TIN" },
  { id: "box1_nec", label: "Box 1 nonemployee compensation" },
];

const CURRENCY_FIELDS = [
  "box1_nec",
  "box1b_cash_tips",
  "box1d_overtime",
  "box3_excess_golden",
  "box4_fed_tax_withheld",
  "box5_state_tax_1",
  "box5_state_tax_2",
  "box7_state_income_1",
  "box7_state_income_2",
];

const TWO_CHAR_FIELDS = [
  { id: "payer_state", label: "Payer's state" },
  { id: "payer_country", label: "Payer's country" },
  { id: "recipient_state", label: "Recipient's state" },
  { id: "recipient_country", label: "Recipient's country" },
];

const read = (values: Record<string, string>, id: string): string =>
  (values[id] ?? "").trim();

export function validate1099Nec({
  values,
}: NecValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const { id, label } of REQUIRED_FIELDS) {
    if (!read(values, id)) {
      errors[id] = `${label} is required.`;
    }
  }

  for (const id of ["payer_tin", "recipient_tin"]) {
    const tin = read(values, id);

    if (tin && !isValidTin(tin)) {
      errors[id] = "Enter a valid 9-digit SSN, ITIN, or EIN.";
    }
  }

  const year = read(values, "calendar_year");

  if (year) {
    const currentYear = new Date().getFullYear();
    const parsed = Number.parseInt(year, 10);

    if (!/^\d{4}$/.test(year)) {
      errors.calendar_year = "Use a 4-digit year (e.g. 2026).";
    } else if (parsed < 1900 || parsed > currentYear + 1) {
      errors.calendar_year = `Year must be between 1900 and ${currentYear + 1}.`;
    }
  }

  for (const id of CURRENCY_FIELDS) {
    const raw = read(values, id);

    if (!raw) continue;

    const cleaned = raw.replace(/[$,]/g, "");

    if (!/^-?\d*\.?\d+$/.test(cleaned)) {
      errors[id] = "Enter an amount, e.g. 15250.00.";
    }
  }

  for (const { id, label } of TWO_CHAR_FIELDS) {
    const raw = read(values, id);

    if (raw && raw.length > 2) {
      errors[id] =
        `${label} must be a 2-letter code — the IRS form only fits two characters.`;
    }
  }

  return errors;
}
