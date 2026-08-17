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

export const logger = {
  info: (...args: LogInput) => writeLog("info", ...args),
  warn: (...args: LogInput) => writeLog("warn", ...args),
  error: (...args: LogInput) => writeLog("error", ...args),
  debug: (...args: LogInput) => writeLog("debug", ...args),
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
