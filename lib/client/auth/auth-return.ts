/**
 * Remembers where an auth flow is about to send the user, so the first
 * signed-in page can recover it if the URL is lost on the way. Clerk's
 * Next.js integration refreshes the current page when the session becomes
 * active; that refresh can win over our `window.location.assign` (seen on
 * WebKit) and drop `?export=…`, so the paywall never opens.
 *
 * One-shot: read and cleared on the first signed-in page load.
 */
const STORAGE_KEY = "pv_auth_return";
const MAX_AGE_MS = 10 * 60 * 1000;
// Differs per full page load. The page that starts the redirect also sees
// the session become active; it must not consume the entry itself.
const PAGE_LOAD_ID = Math.random().toString(36).slice(2);

export function rememberAuthReturn(url: string): void {
  if (!url.startsWith("/") || url.startsWith("//")) return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url, ts: Date.now(), page: PAGE_LOAD_ID }),
    );
  } catch {
    // Storage blocked: the URL alone still carries the intent.
  }
}

/**
 * The remembered return URL if one is pending and fresh, else null.
 * `fromEarlierPage` ignores an entry written by the current page load.
 */
export function peekAuthReturn(
  options: { fromEarlierPage?: boolean } = {},
): string | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;
    const value = JSON.parse(raw) as {
      url?: unknown;
      ts?: unknown;
      page?: unknown;
    };

    if (
      typeof value.url !== "string" ||
      typeof value.ts !== "number" ||
      Date.now() - value.ts > MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY);

      return null;
    }
    if (options.fromEarlierPage && value.page === PAGE_LOAD_ID) return null;

    return value.url;
  } catch {
    return null;
  }
}

export function clearAuthReturn(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
