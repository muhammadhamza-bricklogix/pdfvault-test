/**
 * Compat shim — Sentry has been retired in favour of ECS CloudWatch.
 *
 * The two exported helpers used to pipe user + session context into
 * `Sentry.setUser` / `Sentry.setTag`. They now route through
 * `logger.setContext` so the same information rides on every event
 * shipped by `cloudwatch-shipper` (backend receives it in the request
 * body and writes it as a CloudWatch log-record field).
 *
 * File kept at its original path so downstream callers
 * (`app-providers.tsx`, `use-clerk-user-sync.ts`, etc.) don't need to
 * rewrite imports during the cutover. Once every caller migrates to
 * `logger.setContext` directly, this shim can be deleted.
 */

import { logger } from "./logger";

type UserContext = {
  id: string;
  email?: string;
  username?: string;
};

export function setSentryUser(user: UserContext | null): void {
  logger.setContext("user", user);
}

const SESSION_STORAGE_KEY = "pdfvault:client-session-id";

/**
 * Stable per-tab session identifier. Persists across route changes for
 * the life of the browser tab so every event from one visit shares a
 * `session_id` field — makes "what did this session actually do"
 * queries trivial in CloudWatch Logs Insights.
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
    // fall back to an ephemeral id so context still populates.
    return crypto.randomUUID();
  }
}

export function attachSessionIdTag(): void {
  const id = getOrCreateSessionId();

  if (id) {
    logger.setContext("session", { id });
  }
}
