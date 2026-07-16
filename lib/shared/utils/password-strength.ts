export type PasswordRuleKey =
  | "length"
  | "lowercase"
  | "uppercase"
  | "number"
  | "symbol";

export interface PasswordRule {
  key: PasswordRuleKey;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    key: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    key: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    key: "symbol",
    label: "One symbol (!@#$…)",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export function evaluatePassword(value: string): {
  passed: Record<PasswordRuleKey, boolean>;
  score: number;
  allPassed: boolean;
} {
  const passed = {} as Record<PasswordRuleKey, boolean>;
  let score = 0;

  for (const rule of PASSWORD_RULES) {
    const ok = rule.test(value);

    passed[rule.key] = ok;
    if (ok) score += 1;
  }

  return {
    passed,
    score,
    allPassed: score === PASSWORD_RULES.length,
  };
}
