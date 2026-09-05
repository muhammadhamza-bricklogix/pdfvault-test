import {
  registerUnloadFlush,
  ship,
  type CloudWatchLogLevel,
} from "./cloudwatch-shipper";

type LogInput = unknown[];
type LogLevel = "debug" | "error" | "info" | "warn";
export type SeverityLevel = "debug" | "error" | "fatal" | "info" | "warning";

const isDevelopment = process.env.NODE_ENV !== "production";

// In production, suppress info logs to console unless
// `NEXT_PUBLIC_LOG_LEVEL=verbose`. `warn` + `error` always print. The
// CloudWatch shipper receives ALL events regardless of this fence.
const isVerbose =
  isDevelopment || process.env.NEXT_PUBLIC_LOG_LEVEL === "verbose";

// PDF-editor diagnostic prefix. Every `logger.info(...)` / `logger.warn(...)`
// whose first arg starts with this string is force-printed to the
// browser console via `console.log` / `console.warn` regardless of the
// production fence. Rationale: PDF-editor operators debugging the
// export / conversion pipeline in staging need the boundary logs
// immediately. Full-production (`NEXT_PUBLIC_APP_ENV=production`) still
// suppresses them via `instrumentation-client.ts`.
const FORCE_CONSOLE_PREFIX = "[PDFedits]";

const rawAppEnv =
  process.env.NEXT_PUBLIC_APP_ENV ??
  process.env.NEXT_PUBLIC_ENVIRONMENT ??
  process.env.NEXT_PUBLIC_ENV ??
  process.env.NEXT_PUBLIC_STAGE ??
  process.env.NEXT_PUBLIC_NODE_ENV ??
  "";
const normalizedAppEnv = rawAppEnv.trim().toLowerCase();
const isProductionEnv =
  normalizedAppEnv === "production" || normalizedAppEnv === "prod";

const shouldForceToConsole = (args: LogInput): boolean => {
  if (isProductionEnv) return false;
  const first = args[0];

  return typeof first === "string" && first.startsWith(FORCE_CONSOLE_PREFIX);
};

// Bootstrap the shipper's unload flush. Safe to call on SSR — the
// helper short-circuits on `typeof window === "undefined"`.
if (typeof window !== "undefined") {
  registerUnloadFlush();
}

function toCloudWatchLevel(level: LogLevel): CloudWatchLogLevel {
  if (level === "debug") return "info";

  return level;
}

function severityToShipper(level: SeverityLevel): CloudWatchLogLevel {
  if (level === "error" || level === "fatal") return "error";
  if (level === "warning") return "warn";

  return "info";
}

function argsToData(args: LogInput): Record<string, unknown> {
  const [first, ...rest] = args;
  const data: Record<string, unknown> = {};

  if (first instanceof Error) {
    data.message = first.message;
    data.name = first.name;
    data.stack = first.stack;
  } else if (typeof first === "string") {
    data.message = first;
  } else if (first !== undefined) {
    data.first = first;
  }

  if (rest.length > 0) {
    data.context = rest;
  }

  return data;
}

const writeLog = (level: LogLevel, ...args: LogInput) => {
  const forcePDFedits =
    (level === "info" || level === "warn") && shouldForceToConsole(args);

  if (forcePDFedits) {
    const forcedMethod =
      level === "warn" ? globalThis.console.warn : globalThis.console.log;

    forcedMethod(...args);
  }

  if (level === "debug" && !isDevelopment) {
    // Debug still gets shipped in dev only? — skip shipping entirely.
    return;
  }

  const shouldConsole = level === "warn" || level === "error" || isVerbose;

  if (shouldConsole && !forcePDFedits) {
    const method = globalThis.console[level] ?? globalThis.console.log;

    method(...args);
  }

  // Ship every level EXCEPT dev-only debug to CloudWatch. Levels are
  // capped at `warn` / `error` on the shipper side — CloudWatch queries
  // can filter by level.
  ship({
    timestamp: Date.now(),
    level: toCloudWatchLevel(level),
    event: "log",
    data: argsToData(args),
  });
};

/**
 * Structured breadcrumb — non-error operation log. Ships at `info`
 * level so it appears in CloudWatch as trace context alongside the
 * captured error events. Use for user-visible flow milestones (upload
 * started, paywall shown, export queued).
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

  ship({
    timestamp: Date.now(),
    level: severityToShipper(level),
    event: `breadcrumb.${category}`,
    data: { message, ...(data ?? {}) },
  });
};

/**
 * Structured event — a named success/failure milestone. `info` events
 * ride as low-priority context; `warning`/`error`/`fatal` become
 * queryable failure milestones in CloudWatch (filter by `level`).
 *
 * Naming: `<feature>.<verb>[_<qualifier>]`. See
 * `analytics-events.ts` for the canonical event catalog.
 */
const event = (
  name: string,
  level: SeverityLevel = "info",
  data?: Record<string, unknown>,
): void => {
  if (isVerbose) {
    globalThis.console.info(`[event] ${name}`, data ?? "");
  }

  ship({
    timestamp: Date.now(),
    level: severityToShipper(level),
    event: name,
    data,
  });
};

/**
 * Tagged error capture. Prints to console for local debugging AND ships
 * a structured `error`-level event to CloudWatch with a `feature` field
 * so grouped-by-feature queries work regardless of stack shape.
 */
const captureError = (
  error: unknown,
  feature: string,
  extra?: Record<string, unknown>,
): void => {
  const consoleFn = globalThis.console.error;

  consoleFn(`[${feature}]`, error, extra ?? "");

  const errorData: Record<string, unknown> =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : { value: String(error) };

  ship({
    timestamp: Date.now(),
    level: "error",
    event: "captureError",
    feature,
    data: { ...errorData, ...(extra ?? {}) },
  });
};

/**
 * Wrap an async operation in a lightweight trace span. No Sentry
 * dependency — just times the call, ships a start/end pair to
 * CloudWatch, and rethrows the caller's error unchanged.
 *
 * Kept as a thin wrapper so existing callers (`useSaveEditor`,
 * `useExportEditor`, etc.) don't need to change.
 */
const span = async <T>(
  name: string,
  op: string,
  fn: () => Promise<T> | T,
  attributes?: Record<string, boolean | number | string>,
): Promise<T> => {
  const startedAt = Date.now();

  ship({
    timestamp: startedAt,
    level: "info",
    event: `span.start.${op}`,
    data: { name, ...(attributes ?? {}) },
  });

  try {
    const value = await fn();

    ship({
      timestamp: Date.now(),
      level: "info",
      event: `span.ok.${op}`,
      data: { name, durationMs: Date.now() - startedAt },
    });

    return value;
  } catch (err) {
    ship({
      timestamp: Date.now(),
      level: "warn",
      event: `span.error.${op}`,
      data: {
        name,
        durationMs: Date.now() - startedAt,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
};

/**
 * Ambient context attached to subsequent events. Stashed in a
 * module-level object; every `event` / `captureError` / `breadcrumb`
 * call reads from it via the shipper.
 */
const contextBag: Record<string, Record<string, unknown> | null> = {};

const setContext = (
  key: string,
  value: null | Record<string, unknown>,
): void => {
  contextBag[key] = value;
  ship({
    timestamp: Date.now(),
    level: "info",
    event: "context.set",
    data: { key, value },
  });
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
