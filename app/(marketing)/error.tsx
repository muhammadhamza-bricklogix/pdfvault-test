"use client";

import { useEffect } from "react";

import { logger } from "@/lib/shared/utils/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled application error", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border bg-default-100 p-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Something went wrong.
      </h2>
      <p className="text-sm leading-6 text-default-500">
        The current view failed to load. You can try rendering the page again.
      </p>
      <button
        className="inline-flex w-fit items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-default-100"
        type="button"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
