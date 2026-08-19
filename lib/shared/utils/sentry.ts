import type { SeverityLevel } from "@sentry/nextjs";

import * as Sentry from "@sentry/nextjs";

/**
 * Sentry helpers shared across the app. Wraps common operations so
 * feature code depends on stable names instead of the raw SDK — makes
 * refactors and SDK upgrades cheap.
 */

type SentryUser = {
  id: string;
  email?: string;
  username?: string;
};

/**
 * Attach or clear the current user on all subsequent Sentry events.
 * Called from `SentryUserContext` on Clerk sign-in/out.
 */
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
 * the life of the browser tab so every event from one user visit shares
 * a `session_id` tag — makes "what did this session actually do"
 * queries trivial in the Sentry dashboard.
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

/**
 * Attach ambient context that survives until cleared. Useful for the
 * current document id, active tool, current export format — anything
 * that scopes a whole flow.
 */
export function setSentryContext(
  key: string,
  value: Record<string, unknown> | null,
): void {
  Sentry.setContext(key, value);
}

/**
 * Non-error operation log line. Attached to the next captured event as
 * a breadcrumb trail (Sentry keeps the last 100 by default).
 */
export function addAppBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = "info",
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Structured message capture (not an exception). Use for user-visible
 * success events worth measuring — "paywall_shown", "checkout_started",
 * "export_completed" — so counts + durations are queryable.
 */
export function captureAppEvent(
  name: string,
  level: SeverityLevel = "info",
  data?: Record<string, unknown>,
): void {
  Sentry.captureMessage(name, {
    level,
    extra: data,
    tags: { event_name: name },
  });
}

/**
 * Explicit exception capture with tags. Preferred over `Sentry.captureException`
 * directly because it always sets the `feature` tag so events group by area.
 */
export function captureAppError(
  error: unknown,
  feature: string,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    tags: { feature },
    extra,
  });
}

/**
 * Wrap an async operation in a Sentry trace span. The span shows up in
 * the Performance tab with the given `op` (e.g. "export.pdf",
 * "upload.file") and any attributes provided.
 */
export function runInSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T> | T,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return Sentry.startSpan({ name, op, attributes }, async () => await fn());
}
