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
  // QA F-03: Weglot translates the English error paragraph as
  // "...Die Seite konnte nicht geladen werden. sie können versuchen,
  // sie erneut zu laden." — the first "sie" starts a new sentence and
  // must be capitalised (formal address). Weglot's machine output
  // isn't correctable in the dashboard without an entry per phrase,
  // so render hand-authored German directly on /de/ and let Weglot
  // translate the English copy for the remaining locales.
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
          Die Seite konnte nicht geladen werden. Sie können versuchen, sie
          erneut zu laden.
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
        The page failed to load. You can try rendering it again.
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
