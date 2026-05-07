import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

export function HomeClosingSection() {
  return (
    <section className="w-full py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-accent)] via-red-600 to-red-700 px-8 py-14 text-center shadow-2xl shadow-red-500/20 dark:shadow-red-900/30">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-10 size-56 rounded-full bg-white/10 blur-2xl"
          />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            The ultimate PDF solution
          </p>
          <h2 className="relative mt-3 text-balance text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Edit and manage PDF documents with ease
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-base text-white/80 sm:text-lg">
            PDFedits meets all requirements to edit and manage PDF documents!
          </p>
          <Link
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[var(--color-accent)] shadow-lg transition-transform hover:scale-[1.03]"
            href={ROUTES.TOOLS.PDF_EDITOR}
          >
            Start editing for free →
          </Link>
        </div>
      </div>
    </section>
  );
}
