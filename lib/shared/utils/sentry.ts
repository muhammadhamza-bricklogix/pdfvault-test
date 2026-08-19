import * as Sentry from "@sentry/nextjs";

/**
 * Sentry helpers specific to user + session context. Everything else
 * (breadcrumbs, spans, event capture, error capture, ambient context)
 * lives on `logger` in `./logger.ts` so there's one call surface.
 *
 * The URL scrubber lives in `./scrub-url.ts` so it can be imported from
 * edge runtime configs without pulling the whole Sentry SDK in.
 */

type SentryUser = {
  id: string;
  email?: string;
  username?: string;
};

export function setSentryUser(user: SentryUser | null): void {
  if (!user) {
    Sentry.setUser(null);

    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

const SESSION_STORAGE_KEY = "pdfvault:sentry-session-id";

/**
 * Stable per-tab session identifier. Persists across route changes for
 * the life of the browser tab so every event from one visit shares a
 * `session_id` tag — makes "what did this session actually do" queries
 * trivial in the Sentry dashboard.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const cached = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (cached) {
      return cached;
    }

    const fresh = crypto.randomUUID();

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);

    return fresh;
  } catch {
    // sessionStorage disabled (private mode / cross-origin iframe) —
    // fall back to an ephemeral id so tags still populate.
    return crypto.randomUUID();
  }
}

export function attachSessionIdTag(): void {
  const id = getOrCreateSessionId();

  if (id) {
    Sentry.setTag("session_id", id);
  }
}
