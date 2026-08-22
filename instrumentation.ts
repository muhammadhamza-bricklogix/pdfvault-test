import * as Sentry from "@sentry/nextjs";

/**
 * Next.js 16 instrumentation entrypoint. Runs once per process at startup.
 * Dispatches to the correct Sentry init file based on runtime — nodejs
 * handles the server bundle (app/api routes, server components), edge
 * handles middleware and edge routes.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Capture Next.js 16 server-side request errors (route handlers, RSC).
 * Without this hook, uncaught server errors never reach Sentry.
 */
export const onRequestError = Sentry.captureRequestError;
