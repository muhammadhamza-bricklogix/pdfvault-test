/**
 * Persists partial W-9 state (typed values + drawn signature preview)
 * across refresh, sign-in redirects, and tab restores. Data lives in
 * `sessionStorage` so it's scoped to the browser tab and cleared on
 * tab close.
 *
 * `signatureKey` and `sessionId` are intentionally NOT persisted — the
 * mount always starts a fresh backend session, so the old key would
 * fail the per-session IDOR check. `W9FinalizeIntercept.ensureSignature
 * KeyForSession` re-uploads the restored preview to the new session at
 * finalize time.
 */
const KEY = "pdfvault:pending-w9-state";
// Legacy key from the pre-signature-preview format. Read on migration
// so users mid-fill during the upgrade don't lose their answers.
const LEGACY_VALUES_KEY = "pdfvault:pending-w9-values";

export type PendingW9State = {
  values: Record<string, string>;
  signaturePreview: string | null;
};

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePendingW9State(state: PendingW9State): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage disabled / quota — silent */
  }
}

/**
 * Legacy shim — writes just the values slice. Callers that only have
 * the values map (sign-in redirect flow) hit this; the signature
 * preview stored in the state envelope stays untouched.
 */
export function savePendingW9Values(values: Record<string, string>): void {
  const existing = readPendingW9State();

  savePendingW9State({
    values,
    signaturePreview: existing?.signaturePreview ?? null,
  });
}

export function readPendingW9State(): PendingW9State | null {
  const parsed = safeParse(sessionStorage.getItem(KEY));

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const p = parsed as Partial<PendingW9State>;

    return {
      values:
        p.values && typeof p.values === "object" && !Array.isArray(p.values)
          ? (p.values as Record<string, string>)
          : {},
      signaturePreview:
        typeof p.signaturePreview === "string" ? p.signaturePreview : null,
    };
  }

  // Migration: an older tab may have written the raw values map under
  // the legacy key. Read it once and drop it.
  const legacy = safeParse(sessionStorage.getItem(LEGACY_VALUES_KEY));

  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    try {
      sessionStorage.removeItem(LEGACY_VALUES_KEY);
    } catch {
      /* no-op */
    }

    return {
      values: legacy as Record<string, string>,
      signaturePreview: null,
    };
  }

  return null;
}

/**
 * Kept for callers that only need the values half. Prefer
 * `readPendingW9State()` when you also need the signature preview.
 */
export function readPendingW9Values(): Record<string, string> | null {
  const state = readPendingW9State();

  if (!state) return null;
  const hasValues = Object.keys(state.values).length > 0;

  return hasValues ? state.values : null;
}

export function clearPendingW9Values(): void {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(LEGACY_VALUES_KEY);
  } catch {
    /* no-op */
  }
}
