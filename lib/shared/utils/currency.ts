/**
 * Shared money-format helpers. The whole app renders prices, plan
 * amounts, and invoice totals from the SAME currency the user was
 * quoted (via backend `CheckoutIntent.currency` on paywall / plan
 * pickers, and `Invoice.currency` on billing history). Centralizing the
 * formatter keeps display consistent — a user who paid in EUR sees EUR
 * everywhere, one who paid in PKR sees PKR everywhere, etc.
 *
 * Two variants:
 *   - `formatMinor`      — symbol form ("€12.99", "$12.99") for HTML.
 *   - `formatMinorAscii` — ISO code form ("EUR 12.99") for surfaces
 *                          that can't render non-ASCII glyphs (pdf-lib
 *                          Helvetica is WinAnsi-encoded — it throws on
 *                          €, £, ¥, etc.). Also used as the safe
 *                          fallback when Intl doesn't recognise the
 *                          currency code (rare — non-standard ISO 4217).
 *
 * Amount input is minor-units (cents / paise / öre / …) matching every
 * `amountMinor`, `amountTodayMinor`, `amountRenewMinor` field returned
 * by the backend. Divide-by-100 happens inside the helper so callers
 * never have to remember.
 */

const HTML_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();
const ASCII_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

function getHtmlFormatter(currency: string): Intl.NumberFormat | null {
  const key = currency.toUpperCase();
  const cached = HTML_FORMATTER_CACHE.get(key);

  if (cached) return cached;
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: key,
      minimumFractionDigits: 2,
    });

    HTML_FORMATTER_CACHE.set(key, fmt);

    return fmt;
  } catch {
    return null;
  }
}

function getAsciiFormatter(currency: string): Intl.NumberFormat | null {
  const key = currency.toUpperCase();
  const cached = ASCII_FORMATTER_CACHE.get(key);

  if (cached) return cached;
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: key,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
    });

    ASCII_FORMATTER_CACHE.set(key, fmt);

    return fmt;
  } catch {
    return null;
  }
}

/**
 * Symbol-first format for HTML surfaces. Falls back to
 * `"<amount> <CODE>"` when Intl rejects the currency code.
 */
export function formatMinor(minor: number, currency: string): string {
  const fmt = getHtmlFormatter(currency);
  const amount = minor / 100;

  if (fmt) return fmt.format(amount);

  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Code-first format for surfaces that can't render non-ASCII glyphs
 * (pdf-lib Helvetica / plain-text logs). Same fallback as `formatMinor`
 * for unrecognised codes.
 */
export function formatMinorAscii(minor: number, currency: string): string {
  const fmt = getAsciiFormatter(currency);
  const amount = minor / 100;

  if (fmt) return fmt.format(amount);

  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Symbol + ISO code together (`"$275.22 USD"`, `"₨ 275.22 PKR"`). Use
 * on surfaces where the user needs to verify which currency they were
 * charged in — currency symbols overlap across regions ($ = USD / CAD
 * / AUD / MXN / …) and users occasionally report display bugs when
 * the ambiguous symbol doesn't match the region they expected. Adding
 * the ISO code eliminates the ambiguity without hiding the pretty
 * symbol.
 */
export function formatMinorWithCode(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const symbol = formatMinor(minor, code);

  return `${symbol} ${code}`;
}
