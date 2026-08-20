/**
 * URL sensitive-parameter scrubber. Replaces the values of query params
 * that can leak user data (document ids, share tokens, export formats,
 * tool slugs, redirect URLs, Clerk handshake params) with `[Filtered]`.
 *
 * Shared between axios interceptors and Sentry `beforeSend` hooks so
 * the scrub pattern stays consistent across every place a URL might
 * leave the client.
 */
const SCRUB_QUERY_RE =
  /([?&](?:token|id|export|tool|redirect_url|__clerk[^=]*)=)[^&#]+/gi;

export function scrubUrl(url: string | undefined): string {
  if (!url) {
    return "";
  }

  return url.replace(SCRUB_QUERY_RE, "$1[Filtered]");
}
