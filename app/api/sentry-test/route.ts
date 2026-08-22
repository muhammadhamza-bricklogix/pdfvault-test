import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic endpoint — throws so Sentry can prove that
 * server-side captures are wired end to end. Once you've confirmed the
 * event lands in the Sentry dashboard, delete this file.
 *
 * Usage:
 *   curl -i https://<your-host>/api/sentry-test
 *   curl -i https://<your-host>/api/sentry-test?message=custom-message
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get("message") ?? "sentry-test: server throw";

  throw new Error(message);
}
