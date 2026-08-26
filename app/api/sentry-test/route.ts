import { NextResponse } from "next/server";

/**
 * Sentry smoke-test route — gated to non-production so a hostile caller
 * can't spam the Sentry ingestion budget or use the DSN error shape as a
 * signal for framework fingerprinting. Delete once you no longer need it.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const message = searchParams.get("message") ?? "sentry-test: server throw";

  throw new Error(message);
}
