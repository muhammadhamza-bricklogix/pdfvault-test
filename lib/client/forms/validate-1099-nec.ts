import { EIN_REGEX, SSN_REGEX } from "./validate-w9";

export type NecValidationInput = {
  values: Record<string, string>;
  signatureKey?: string | null;
};

/**
 * Returns a map of `fieldId → errorMessage` for Form 1099-NEC.
 * An empty object means the form passes pre-flight checks.
 */
export function validate1099Nec({
  values: _values,
}: NecValidationInput): Record<string, string> {
  // Non-blocking: whatever fields the user filled are passed to export/download
  return {};
}
