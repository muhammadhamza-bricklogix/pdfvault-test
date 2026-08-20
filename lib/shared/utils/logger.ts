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
 * Structured event — a named success/failure milestone. Info-level
 * events land as breadcrumbs (cheap, attached to the next captured
 * event as trace context). Only warning/error/fatal levels are
 * escalated to `captureMessage` so we don't burn the Sentry quota on
 * routine flow milestones (paywall opened, save ok, upload success).
 */
const event = (
  name: string,
  level: SeverityLevel = "info",
  data?: Record<string, unknown>,
): void => {
  if (isVerbose) {
    globalThis.console.info(`[event] ${name}`, data ?? "");
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const shouldCapture =
    level === "warning" || level === "error" || level === "fatal";

  if (shouldCapture) {
    Sentry.captureMessage(name, {
      level,
      extra: data,
      tags: { event_name: name },
    });

    return;
  }

  Sentry.addBreadcrumb({
    category: "event",
    message: name,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
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
 *
 * Sentry's browser tracing can throw `AbortError: Transition was skipped`
 * when a React transition supersedes another mid-span (TanStack Query
 * mutations trigger transitions on state updates, so a user clicking
 * Convert → DOCX while another async op is in flight can trip this).
 * That abort was killing the actual conversion mutation before its HTTP
 * request even fired — the user saw "Uncaught AbortError" and the
 * backend logged zero `/conversion` calls. Guard by running `fn()`
 * directly if Sentry's span setup throws, so the app path always
 * completes even when tracing is unhappy.
 */
const span = async <T>(
  name: string,
  op: string,
  fn: () => Promise<T> | T,
  attributes?: Record<string, boolean | number | string>,
): Promise<T> => {
  try {
    return await Sentry.startSpan(
      { name, op, attributes },
      async () => await fn(),
    );
  } catch (err: unknown) {
    const isSentryTransitionAbort =
      err instanceof Error &&
      err.name === "AbortError" &&
      /transition was skipped/i.test(err.message);

    if (!isSentryTransitionAbort) throw err;
    // Sentry's tracing bailed but the wrapped work must still run and
    // its result / error must reach the caller.
    return await fn();
  }
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
