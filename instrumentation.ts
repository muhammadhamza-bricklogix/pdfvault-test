/**
 * Next.js 16 server instrumentation entrypoint. Runs once per process
 * at startup.
 *
 * Sentry was removed in favour of ECS CloudWatch. This file is kept as
 * a no-op so Next.js has a `register` hook to call and an
 * `onRequestError` export to install — otherwise it would log a
 * "missing instrumentation" warning on cold-start.
 *
 * Server-side request errors (route handlers, RSC) are now captured
 * by:
 *   - ECS task stdout → CloudWatch log group (all `console.error` from
 *     the running server bundle).
 *   - The frontend `cloudwatch-shipper` for client-observed failures.
 *
 * If server-side error capture needs to graduate beyond `console.error`
 * (e.g. structured events with request context), wire an ECS-side
 * middleware that formats + writes to CloudWatch directly, rather than
 * re-adding a third-party SDK here.
 */

export async function register(): Promise<void> {
  // No-op — server bundle logs land in CloudWatch via ECS stdout.
}

/**
 * Next.js 16 server-error hook. Log to stdout so ECS forwards to
 * CloudWatch; deliberately no third-party sink.
 */
export function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: { routerKind: string; routePath: string; routeType: string },
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Structured single-line JSON so CloudWatch Logs Insights can parse
  // it with `parse @message` filters.
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      event: "server.request_error",
      level: "error",
      message,
      stack,
      request: {
        path: request.path,
        method: request.method,
      },
      context,
      timestamp: new Date().toISOString(),
    }),
  );
}
