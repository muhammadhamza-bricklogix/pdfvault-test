"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { logger } from "@/lib/shared/utils/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const pathname = usePathname();
  // DE QA: Weglot's auto-translation of "You can try rendering it
  // again." produced a lowercase "sie" at sentence start, which is
  // ungrammatical for the formal address. Two safeguards:
  //   1. Hand-authored German on /de/* bypasses Weglot entirely.
  //   2. The English fallback below is reworded so Weglot's German
  //      output starts the second sentence with "Bitte …" instead of
  //      "sie …" — this keeps the non-/de/* locales clean too.
  const isDe = pathname?.split("/")[1] === "de";

  useEffect(() => {
    logger.error("Unhandled landing error", error);
  }, [error]);

  if (isDe) {
    return (
      <div
        className="notranslate wg-notranslate mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border bg-default-100 p-6"
        translate="no"
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          Es ist ein Fehler aufgetreten.
        </h2>
        <p className="text-sm leading-6 text-default-500">
          Die Seite konnte nicht geladen werden. Bitte versuchen Sie, sie erneut
          zu laden.
        </p>
        <button
          className="inline-flex w-fit items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-default-100"
          type="button"
          onClick={() => reset()}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border bg-default-100 p-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Something went wrong.
      </h2>
      <p className="text-sm leading-6 text-default-500">
        The page failed to load. Please try reloading it.
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
