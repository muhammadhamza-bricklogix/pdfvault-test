import * as Sentry from "@sentry/nextjs";

import { scrubUrl } from "@/lib/shared/utils/scrub-url";

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

  // Both Replay AND browserTracing integrations are lazy-loaded below
  // (`lazyLoadIntegration`) AFTER first paint — they were the two
  // heaviest Sentry sub-bundles blocking landing TBT. Errors are still
  // captured synchronously by the core SDK; router-transition spans and
  // session replays start ~2.5s later, which is an acceptable
  // observability trade-off for the perf win.
  integrations: [],

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

// Lazy-load session replay AND browser tracing AFTER first paint to
// keep the initial JS budget lean on landing. Both add substantial
// weight (~100 KiB replay, ~50 KiB tracing gzip) and neither is
// required for error capture, which is what the sync core SDK above
// handles. `lazyLoadIntegration` resolves to a dynamic import so
// each chunk only lands when this idle callback fires.
//
// Cost of deferring browserTracing: `Sentry.captureRouterTransitionStart`
// (exported below for Next 16 App Router) is a no-op until this fires,
// so router transitions in the first ~2.5s of a session aren't
// captured as spans. Session-start transitions are still captured via
// pageload spans; subsequent client-side navs are captured normally
// once the integration is live. Acceptable trade-off for the TBT win.
if (
  typeof window !== "undefined" &&
  (process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === "true")
) {
  const loadDeferredIntegrations = () => {
    // browserTracing is bundled in Sentry core (`@sentry/browser`) and
    // isn't a valid target for `lazyLoadIntegration` (only Replay /
    // Feedback / Console-style integrations are). Calling it directly
    // inside this idle callback keeps its ADD side-effect out of the
    // synchronous init critical path — the code still ships in the core
    // Sentry chunk but doesn't execute during hydration.
    const client = Sentry.getClient();

    if (client) {
      client.addIntegration(Sentry.browserTracingIntegration());
    }

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
    idle(loadDeferredIntegrations, { timeout: 4000 });
  } else {
    window.setTimeout(loadDeferredIntegrations, 2500);
  }
}
