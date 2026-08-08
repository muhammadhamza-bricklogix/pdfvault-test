import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send events in production.
  enabled: process.env.NODE_ENV === "production",

  // Capture 10% of traces for performance monitoring — raise after baseline.
  tracesSampleRate: 0.1,

  // Don't capture replays by default; enable via Sentry dashboard if needed.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  // Don't log Sentry internals to the console.
  debug: false,

  // Ignore known non-actionable errors.
  ignoreErrors: [
    // Network-level noise
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    // Browser extension interference
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Clerk hydration noise on first load
    /NEXT_NOT_FOUND/,
  ],
});
