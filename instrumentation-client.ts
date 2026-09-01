import * as Sentry from "@sentry/nextjs";

import { scrubUrl } from "@/lib/shared/utils/scrub-url";

/**
 * Silence the browser console in the production environment. Staging /
 * preview / dev keep full console output for debugging. Runs BEFORE
 * `Sentry.init` so Sentry's console integration wraps the no-op methods
 * — breadcrumbs still fire, DevTools stays clean. `logger.captureError`
 * / `logger.event` continue to ship errors + warnings via explicit
 * `Sentry.captureException` / `captureMessage` calls (not console).
 *
 * Environment detection is intentionally permissive: whichever name your
 * AWS Secrets Manager (or Railway env, or CI pipeline) uses to identify
 * production will work as long as it's exposed as a `NEXT_PUBLIC_*` var
 * at build time. Recognised names, in priority order:
 *   NEXT_PUBLIC_APP_ENV
 *   NEXT_PUBLIC_ENVIRONMENT
 *   NEXT_PUBLIC_ENV
 *   NEXT_PUBLIC_STAGE
 *   NEXT_PUBLIC_NODE_ENV
 * Accepted production values: "production" | "prod" (case-insensitive).
 */
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

if (typeof window !== "undefined" && isProductionEnv) {
  const noop = () => undefined;
  const silenced = [
    "log",
    "info",
    "debug",
    "warn",
    "error",
    "trace",
    "table",
    "dir",
    "dirxml",
    "group",
    "groupCollapsed",
    "groupEnd",
    "time",
    "timeEnd",
    "timeLog",
    "count",
    "countReset",
    "assert",
  ] as const;

  for (const key of silenced) {
    (window.console as unknown as Record<string, () => void>)[key] = noop;
  }
}

/**
 * Client-side Sentry init for Next.js 16 App Router. Replaces the legacy
 * `sentry.client.config.ts` file. Loaded automatically by Next.js before
 * any client bundle runs.
 *
 * Env vars:
 *   NEXT_PUBLIC_SENTRY_DSN         — required in prod; empty in dev by default
 *   NEXT_PUBLIC_APP_VERSION        — optional release tag (git SHA)
 *   NEXT_PUBLIC_APP_ENV            — optional env label (production/staging/preview)
 *   NEXT_PUBLIC_SENTRY_ENABLE_DEV  — set to "true" to send events from dev builds
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === "true",

  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Errors: 100%. Traces: 20% in prod (raise after baseline), 100% in dev.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Session Replay: sample 10% of all sessions + 100% of sessions with an error.
  // PDFs contain user IP — mask everything by default. Only unmasked content is
  // navigation chrome (nav, footer, generic UI).
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Replay integration is added lazily below (`lazyLoadIntegration`)
  // AFTER first paint — session replay is the heaviest Sentry sub-bundle
  // (~100 KiB gzip) and it was blocking landing LCP + TBT. Kept
  // browserTracing here because router transitions rely on it being
  // ready during hydration.
  integrations: [Sentry.browserTracingIntegration()],

  debug: false,

  ignoreErrors: [
    // Network-level noise (user offline, ad-blocker, browser cancel)
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "AbortError",
    // ResizeObserver browser quirk — noisy, harmless
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Clerk/Next hydration
    /NEXT_NOT_FOUND/,
    // Stale bundle after deploy — user reloads and it's gone
    "ChunkLoadError",
    /Loading chunk \d+ failed/,
    // Non-Error rejections we already log elsewhere
    /Non-Error promise rejection captured/,
    // User-cancelled paywall — expected control flow, not an error
    "PaywallCancelledError",
    // Third-party extension/injected scripts
    /extension\//i,
    /^chrome-extension:/,
    /^moz-extension:/,
    /^safari-extension:/,
  ],

  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
  ],

  /**
   * Scrub sensitive request context before events leave the browser.
   * - Strip Authorization / Cookie headers
   * - Filter document id, export format, tool, and share token from URL/query
   */
  beforeSend(event) {
    const headers = event.request?.headers as
      | Record<string, string>
      | undefined;

    if (headers) {
      delete headers.Authorization;
      delete headers.authorization;
      delete headers.Cookie;
      delete headers.cookie;
    }

    if (event.request?.url) {
      event.request.url = scrubUrl(event.request.url);
    }

    if (
      typeof event.request?.query_string === "string" &&
      event.request.query_string
    ) {
      event.request.query_string = scrubUrl(event.request.query_string);
    }

    return event;
  },

  /**
   * Drop noisy console breadcrumbs in production. Warnings + errors from
   * `console.warn` / `console.error` still flow through the app logger and
   * are captured explicitly.
   */
  beforeBreadcrumb(breadcrumb) {
    if (
      process.env.NODE_ENV === "production" &&
      breadcrumb.category === "console" &&
      breadcrumb.level !== "error" &&
      breadcrumb.level !== "warning"
    ) {
      return null;
    }

    return breadcrumb;
  },
});

// Required export for Next.js 16 App Router — Sentry hooks router transitions
// so client-side navigations are captured as spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Lazy-load session replay AFTER first paint to keep the initial JS
// budget lean on landing. Replay adds ~100 KiB gzip and doesn't need
// to be live during the LCP window — errors are still captured because
// the core SDK initialised synchronously above. `lazyLoadIntegration`
// resolves to a dynamic import so the chunk lands only when this fires.
if (
  typeof window !== "undefined" &&
  (process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === "true")
) {
  const loadReplay = () => {
    void Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => {
        Sentry.getClient()?.addIntegration(
          replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
            networkDetailAllowUrls: [],
          }),
        );
      })
      .catch(() => undefined);
  };

  const idle = (
    window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => void;
    }
  ).requestIdleCallback;

  if (typeof idle === "function") {
    idle(loadReplay, { timeout: 4000 });
  } else {
    window.setTimeout(loadReplay, 2500);
  }
}
