import * as Sentry from "@sentry/nextjs";

import { scrubUrl } from "@/lib/shared/utils/scrub-url";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.APP_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  debug: false,

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

    return event;
  },
});
