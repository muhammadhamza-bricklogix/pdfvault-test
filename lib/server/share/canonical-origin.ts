/**
 * Resolve the public origin the current request arrived on.
 *
 * The share feature stores bytes in-memory keyed by `jti`. If the URL we
 * hand back to the user points at a DIFFERENT origin than the one that
 * served the create request, the resolve/bytes routes on that other host
 * won't find the entry and the share page renders "server error" —
 * exactly the bug QA reported when a share created on
 * `staging.pdfvault.ai` produced a `www.pdfvault.ai/share/...` URL.
 *
 * Priority (matches the pattern already used by `proxy.ts`):
 *   1. `x-forwarded-host` (+ `x-forwarded-proto`) — set by CloudFront /
 *      any reverse proxy in front of the app. This is the source of
 *      truth for "what host did the user actually hit?".
 *   2. `host` header on the raw request — direct-hit local dev.
 *   3. `NEXT_PUBLIC_APP_URL` — last-ditch fallback (kept because some
 *      background jobs / unit tests may not have a request handy). Env
 *      values are frequently stale across envs, hence the low priority.
 */
export function getCanonicalOrigin(
  headers: Headers,
  fallbackOrigin?: string,
): string {
  const fwdHost = headers.get("x-forwarded-host");
  const fwdProto = headers.get("x-forwarded-proto");

  if (fwdHost) {
    return `${fwdProto ?? "https"}://${fwdHost}`;
  }

  const host = headers.get("host");

  if (host) {
    const proto = fwdProto ?? (host.startsWith("localhost") ? "http" : "https");

    return `${proto}://${host}`;
  }

  if (fallbackOrigin) {
    return fallbackOrigin.replace(/\/$/, "");
  }

  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  return envOrigin ?? "http://localhost:3000";
}
