"use client";

import NextError from "next/error";
import { useEffect } from "react";

import { logger } from "@/lib/shared/utils/logger";

type GlobalErrorProps = {
  error: Error & { digest?: string };
};

/**
 * App Router root error boundary. Fires when a React render throws above
 * every route's own error.tsx. Ships the error to CloudWatch (via
 * `logger.captureError`) and renders Next's built-in error page so the
 * user always sees something.
 */
export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    logger.captureError(error, "app.global-error", {
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
