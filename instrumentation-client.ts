/**
 * Client-side instrumentation entrypoint. Two responsibilities now that
 * Sentry has been retired in favour of ECS CloudWatch:
 *
 *   1. Silence the browser console in the production environment so the
 *      DevTools stays clean for end users. Staging / preview / dev keep
 *      full console output for debugging. `logger.captureError` /
 *      `logger.event` continue to ship errors + warnings to CloudWatch
 *      via the `cloudwatch-shipper` regardless of console silencing.
 *   2. Expose a no-op `onRouterTransitionStart` export so Next.js 16's
 *      App Router doesn't warn about the missing hook. Router
 *      transitions no longer need to be instrumented client-side
 *      (backend timing lands via ALB / CloudWatch on request handlers).
 *
 * Environment detection is intentionally permissive: whichever name
 * your AWS Secrets Manager (or CI pipeline) uses to identify production
 * will work as long as it's exposed as a `NEXT_PUBLIC_*` var at build
 * time. Recognised names, in priority order:
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

// Next.js 16 App Router expects this export. Kept as a no-op so router
// transitions don't warn. If per-transition telemetry is needed later,
// ship a `logger.event("router.transition_start", ...)` from here.
export function onRouterTransitionStart(): void {
  // Intentional no-op — router-transition tracing was Sentry-only.
}
