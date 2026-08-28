/**
 * User-currency resolver for the billing surfaces.
 *
 * Backend bug: `/billing/invoices` returns `currency: "USD"` on every
 * Payment row regardless of what Solidgate actually charged the user
 * in (PKR, EUR, INR, …). The `amountMinor` value IS correct (in the
 * user's charge currency) — only the ISO code label is wrong. QA report
 * 2026-08-28 → 29 flagged this on a PKR-paid subscription showing as
 * "$275.22 USD" on the billing table + receipt PDF.
 *
 * Until the backend Payment writer + webhook handler are fixed, the
 * frontend leans on the localised `Plan` catalog: `/billing/plans`
 * returns the user's plans with the correct `currency` field for their
 * region (that's the same currency Solidgate uses at checkout). We
 * capture the first plan's currency on mount, mirror it into
 * localStorage, and use it to override any invoice row whose backend
 * `currency` came back as USD when the user's regional currency is
 * something else.
 *
 * When the backend is fixed, this file can be deleted and callers
 * reverted to reading `row.currency` directly — grep for
 * `resolveDisplayCurrency`.
 */

const STORAGE_KEY = "pdfvault:userCurrency";

/**
 * Persist the currency the backend quoted the user (from either the
 * Plan catalog or a fresh CheckoutIntent). Silent no-op when storage
 * is unavailable (private mode, cookies disabled).
 */
export function persistUserCurrency(currency: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!currency) return;
  const normalized = currency.toUpperCase().trim();

  if (!normalized) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // private-mode / cookies disabled → ignore.
  }
}

/**
 * Read the last-known persisted currency for this browser session.
 * Returns null when nothing was captured yet or storage is unavailable.
 */
export function readPersistedUserCurrency(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw ? raw.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Pick the best currency to DISPLAY for an invoice row. Prefers the
 * region-correct override when the backend value is the fallback "USD"
 * default and the user's real currency is known to be different.
 *
 * Never overrides when:
 *   - the override is missing / equal to the backend value
 *   - the backend already returned a non-USD currency (assume correct)
 *
 * The second rule is important: users who legitimately paid in USD must
 * keep seeing USD. Only the "backend defaulted to USD when actual was
 * something else" case gets rewritten.
 */
export function resolveDisplayCurrency(
  backendCurrency: string,
  override: string | null | undefined,
): string {
  const back = (backendCurrency ?? "").toUpperCase();
  const over = (override ?? "").toUpperCase();

  if (!back) return over || "USD";
  if (!over) return back;
  if (back !== "USD") return back; // trust non-USD backend values.
  if (over === "USD") return back;

  return over;
}
