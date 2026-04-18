type LogInput = unknown[];
type LogLevel = "debug" | "error" | "info" | "warn";

const isDevelopment = process.env.NODE_ENV !== "production";

const writeLog = (level: LogLevel, ...args: LogInput) => {
  if (level === "debug" && !isDevelopment) {
    return;
  }

  const method = globalThis.console[level] ?? globalThis.console.log;

  method(...args);
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
