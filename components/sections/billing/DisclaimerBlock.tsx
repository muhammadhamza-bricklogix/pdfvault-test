"use client";

import { DISCLAIMER_TEMPLATE } from "@/lib/shared/constants/billing";
import { formatMinor } from "@/lib/shared/utils/currency";

interface DisclaimerBlockProps {
  amountTodayMinor: number;
  amountRenewMinor: number;
  intervalLabel: string;
  currency: string;
}

/**
 * Renders the verbatim negative-option billing disclaimer that MUST sit
 * immediately adjacent to the pay button. Never split the sentences,
 * never hide part of it behind a "read more" toggle — the entire
 * paragraph is one legal unit.
 *
 * The copy is not editable per-render; only the three numeric
 * placeholders (`{today}`, `{renew}`, `{cycle}`) get filled in. If the
 * base template needs to change, edit `DISCLAIMER_TEMPLATE` and bump
 * `DISCLAIMER_VERSION` so the ConsentRecord log points at the new copy.
 */
export function DisclaimerBlock({
  amountTodayMinor,
  amountRenewMinor,
  intervalLabel,
  currency,
}: DisclaimerBlockProps) {
  // Shared `formatMinor` keeps the disclaimer's amounts in the same
  // format as the paywall + success step + billing table.
  const body = DISCLAIMER_TEMPLATE.replace(
    "{today}",
    formatMinor(amountTodayMinor, currency),
  )
    .replace("{renew}", formatMinor(amountRenewMinor, currency))
    .replace("{cycle}", intervalLabel);

  return (
    <p className="rounded-lg bg-default-50 px-3 py-2 text-[11px] leading-relaxed text-default-600 dark:bg-default-900 dark:text-default-400">
      {body}
    </p>
  );
}
