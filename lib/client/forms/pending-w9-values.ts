/**
 * Persists W-9 field values across a sign-in redirect so the user
 * doesn't lose their typed data when Download prompts them to sign in.
 * sessionStorage is scoped to the tab, cleared on close — the right
 * lifetime for a mid-fill snapshot.
 *
 * Signature key + sessionId are intentionally NOT persisted: after
 * sign-in the bootstrap always starts a fresh session (schema + pdfUrl
 * come from that call), so the old session id would be orphaned and
 * the signature key wouldn't pass the backend's per-session IDOR check.
 * The user re-signs on return, which is acceptable — losing every
 * typed field vs re-drawing one signature is the trade we're making.
 */
const KEY = "pdfvault:pending-w9-values";

export function savePendingW9Values(values: Record<string, string>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    /* storage disabled / quota — silent, sign-in still proceeds */
  }
}

export function readPendingW9Values(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(KEY);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }

    return null;
  } catch {
    return null;
  }
}

export function clearPendingW9Values(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
