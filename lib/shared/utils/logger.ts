import type { SeverityLevel } from "@sentry/nextjs";

import * as Sentry from "@sentry/nextjs";

type LogInput = unknown[];
type LogLevel = "debug" | "error" | "info" | "warn";

const isDevelopment = process.env.NODE_ENV !== "production";

// In production, suppress info logs unless NEXT_PUBLIC_LOG_LEVEL=verbose.
// Only warn + error ship to any remote sink (e.g. Sentry).
const isVerbose =
  isDevelopment || process.env.NEXT_PUBLIC_LOG_LEVEL === "verbose";

// PDF-editor diagnostic prefix. Every `logger.info(...)` / `logger.warn(...)`
// call whose first arg starts with this string is force-printed to the
// browser console via `console.log` / `console.warn` regardless of
// environment or `NEXT_PUBLIC_LOG_LEVEL`. Rationale: users debugging the
// export / conversion pipeline in staging (NODE_ENV=production) need to
// SEE the boundary logs immediately without flipping a Sentry filter or
// setting an env var and redeploying.
const FORCE_CONSOLE_PREFIX = "[PDFedits]";

const shouldForceToConsole = (args: LogInput): boolean => {
  const first = args[0];

  return typeof first === "string" && first.startsWith(FORCE_CONSOLE_PREFIX);
};

const writeLog = (level: LogLevel, ...args: LogInput) => {
  const forcePDFedits =
    (level === "info" || level === "warn") && shouldForceToConsole(args);

  // PDFedits diagnostics — force to the browser console at all times so
  // they show up in production/staging DevTools without any filter.
  if (forcePDFedits) {
    const forcedMethod =
      level === "warn" ? globalThis.console.warn : globalThis.console.log;

    forcedMethod(...args);
  }

  if (level === "debug" && !isDevelopment) {
    return;
  }

  if (level === "info" && !isVerbose) {
    // Already emitted above via force-console if it was a PDFedits log,
    // so we can safely stop here.
    return;
  }

  const method = globalThis.console[level] ?? globalThis.console.log;

  // Avoid double-printing when we already force-emitted this line above.
  if (!forcePDFedits) {
    method(...args);
  }

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
 * Sentry's browser tracing + Clerk's session-resume + the browser's
 * View Transitions API can all throw transition-related errors
 * inside `Sentry.startSpan` when a React transition supersedes another
 * mid-span (TanStack Query mutations trigger transitions on state
 * updates, so a user clicking Convert → DOCX while another async op
 * is in flight can trip this). The known thrown shapes:
 *   - AbortError: "Transition was skipped"        (Sentry own throw)
 *   - InvalidStateError: "Transition was aborted because of invalid state"
 *     (browser View Transitions / Clerk transitions)
 *
 * Any of these thrown from `startSpan` was killing the actual mutation
 * before its HTTP request even fired — the user saw the raw error and
 * the backend logged zero requests. Guard by running `fn()` directly
 * whenever the throw looks like a transition-plumbing issue rather
 * than a real failure from the wrapped work, so the user-facing path
 * always completes even when tracing / router transitions are unhappy.
 * This is safe because if `fn()` itself throws for a real reason, the
 * inner promise rejection would be raised BY `fn()` (not by
 * `Sentry.startSpan`'s setup) — see the try{}/catch{} boundary.
 */
const isTransitionPlumbingError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const name = err.name;
  const message = err.message;
  const stack = err.stack ?? "";

  if (name === "AbortError" && /transition was skipped/i.test(message)) {
    return true;
  }

  if (
    name === "InvalidStateError" &&
    /transition was aborted|invalid state/i.test(message)
  ) {
    return true;
  }

  // 2026-08-28: Sentry browser-tracing's web-vitals reporter throws
  //   TypeError: Cannot read properties of undefined (reading 'startTime')
  // from `et.reportAllChanges` when a PerformanceObserver callback fires
  // with an unexpected entry shape (extensions / DevTools interfering,
  // BFCache restores, page-visibility transitions). Symptom user reported:
  // "clicked any tool → console TypeError → saving toast shows but nothing
  // saves" — the TypeError bubbled up through `Sentry.startSpan`, rejected
  // the wrapping `logger.span` promise, and prevented the save's
  // `onComplete` callback from running (the "Saving…" toast hangs, the
  // caller's action never proceeds).
  if (
    name === "TypeError" &&
    (/reading 'startTime'/i.test(message) ||
      /reportAllChanges/i.test(stack) ||
      /web-vitals/i.test(stack))
  ) {
    return true;
  }

  return false;
};

const span = async <T>(
  name: string,
  op: string,
  fn: () => Promise<T> | T,
  attributes?: Record<string, boolean | number | string>,
): Promise<T> => {
  // Book-keeping so we can distinguish a real error from `fn()` (must
  // rethrow) vs. a Sentry / router / web-vitals instrumentation throw
  // (safe to retry `fn()` — or reuse its result if it already ran).
  let fnStarted = false;
  let fnCompleted = false;
  let fnResult: T | undefined;
  let fnError: unknown = null;

  const guardedFn = async (): Promise<T> => {
    fnStarted = true;
    try {
      const value = await fn();

      fnResult = value;
      fnCompleted = true;

      return value;
    } catch (err) {
      fnError = err;
      throw err;
    }
  };

  try {
    return await Sentry.startSpan({ name, op, attributes }, guardedFn);
  } catch (err: unknown) {
    // `fn()` ran to completion and returned a value — the throw came from
    // Sentry's span-close plumbing (e.g. web-vitals TypeError while the
    // span was being finalized). Return the real result so the caller's
    // pipeline (save → onComplete → close toast) continues.
    if (fnCompleted) {
      return fnResult as T;
    }

    // `fn()` started AND threw its own error — that's the real failure the
    // caller cares about. Rethrow the ORIGINAL error, not the plumbing one.
    if (fnStarted && fnError !== null) {
      throw fnError;
    }

    // `fn()` never ran — instrumentation broke during span setup. Rerun
    // the wrapped work directly so save / export / upload flows still
    // complete. Only accept known-plumbing errors here so a real Sentry
    // bug we should surface doesn't get silently retried.
    if (isTransitionPlumbingError(err)) {
      return await fn();
    }

    throw err;
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
