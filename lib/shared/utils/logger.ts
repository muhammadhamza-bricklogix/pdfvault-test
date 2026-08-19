import type { SeverityLevel } from "@sentry/nextjs";

import * as Sentry from "@sentry/nextjs";

type LogInput = unknown[];
type LogLevel = "debug" | "error" | "info" | "warn";

const isDevelopment = process.env.NODE_ENV !== "production";

// In production, suppress info logs unless NEXT_PUBLIC_LOG_LEVEL=verbose.
// Only warn + error ship to any remote sink (e.g. Sentry).
const isVerbose =
  isDevelopment || process.env.NEXT_PUBLIC_LOG_LEVEL === "verbose";

const writeLog = (level: LogLevel, ...args: LogInput) => {
  if (level === "debug" && !isDevelopment) {
    return;
  }

  if (level === "info" && !isVerbose) {
    return;
  }

  const method = globalThis.console[level] ?? globalThis.console.log;

  method(...args);

  // Forward errors and warnings to Sentry in production.
  if (
    process.env.NODE_ENV === "production" &&
    (level === "error" || level === "warn")
  ) {
    const [first, ...rest] = args;

    if (first instanceof Error) {
      Sentry.captureException(first, { extra: { context: rest } });
    } else {
      Sentry.captureMessage(String(first), {
        level: level === "error" ? "error" : "warning",
        extra: { context: rest },
      });
    }
  }
};

/**
 * Structured breadcrumb — non-error operation log. Attached to any
 * subsequent captured event as trace context. Prefer this over
 * `logger.info` for user-visible flow milestones (upload started,
 * paywall shown, export queued) so error events always ship with the
 * story that led up to them.
 */
const breadcrumb = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = "info",
): void => {
  if (isDevelopment) {
    globalThis.console.info(`[${category}] ${message}`, data ?? "");
  }

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Structured event capture — a named success/failure milestone worth
 * counting or querying in the Sentry dashboard. Use for outcomes like
 * "checkout.completed", "upload.duplicate_detected", "paywall.dismissed".
 * Errors go through `logger.error` / `captureError` instead.
 */
const event = (
  name: string,
  level: SeverityLevel = "info",
  data?: Record<string, unknown>,
): void => {
  if (isVerbose) {
    globalThis.console.info(`[event] ${name}`, data ?? "");
  }

  if (process.env.NODE_ENV === "production") {
    Sentry.captureMessage(name, {
      level,
      extra: data,
      tags: { event_name: name },
    });
  }
};

/**
 * Tagged error capture. Same as `logger.error` but always sets the
 * `feature` tag so grouped-by-feature searches in Sentry work
 * regardless of stack shape.
 */
const captureError = (
  error: unknown,
  feature: string,
  extra?: Record<string, unknown>,
): void => {
  const consoleFn = globalThis.console.error;

  consoleFn(`[${feature}]`, error, extra ?? "");

  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      tags: { feature },
      extra,
    });
  }
};

/**
 * Wrap an async operation in a Sentry trace span. The span appears in
 * the Performance tab under the given `op` — use short, greppable
 * values like "export.pdf", "upload.file", "checkout.intent".
 */
const span = <T>(
  name: string,
  op: string,
  fn: () => Promise<T> | T,
  attributes?: Record<string, boolean | number | string>,
): Promise<T> => {
  return Sentry.startSpan({ name, op, attributes }, async () => await fn());
};

/**
 * Ambient context attached to all subsequent events. Use for the
 * current document id, active tool, session-scoped state.
 */
const setContext = (
  key: string,
  value: null | Record<string, unknown>,
): void => {
  Sentry.setContext(key, value);
};

export const logger = {
  info: (...args: LogInput) => writeLog("info", ...args),
  warn: (...args: LogInput) => writeLog("warn", ...args),
  error: (...args: LogInput) => writeLog("error", ...args),
  debug: (...args: LogInput) => writeLog("debug", ...args),
  breadcrumb,
  event,
  captureError,
  span,
  setContext,
  time: (label: string) => {
    if (!isDevelopment) {
      return;
    }

    globalThis.console.time(label);
  },
  timeEnd: (label: string) => {
    if (!isDevelopment) {
      return;
    }

    globalThis.console.timeEnd(label);
  },
  group: (label?: string) => {
    if (!isDevelopment) {
      return;
    }

    if (label) {
      globalThis.console.group(label);

      return;
    }

    globalThis.console.group();
  },
  groupEnd: () => {
    if (!isDevelopment) {
      return;
    }

    globalThis.console.groupEnd();
  },
};
