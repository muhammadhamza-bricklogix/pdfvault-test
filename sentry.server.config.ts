import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.APP_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  debug: false,

  ignoreErrors: [
    // Client aborted the request before the server finished responding.
    "AbortError",
    "ResponseAborted",
    /ECONNRESET/,
    /EPIPE/,
  ],

  /**
   * Strip auth headers + scrub tokens from URLs before sending. The server
   * bundle sees full Authorization headers on every proxied request — those
   * must never land in Sentry.
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
      delete headers["x-clerk-auth-token"];
    }

    if (event.request?.url) {
      event.request.url = event.request.url.replace(
        /([?&](?:token|id|export|tool|redirect_url|__clerk[^=]*)=)[^&#]+/gi,
        "$1[Filtered]",
      );
    }

    return event;
  },
});
