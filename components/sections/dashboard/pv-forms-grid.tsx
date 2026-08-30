import { ArrowRight02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

type IconGlyph = typeof File01Icon;

interface FormCardEntry {
  title: string;
  description: string;
  href: string;
  icon: IconGlyph;
}

// Grid mirrors `PvToolsGrid`'s tile pattern so Forms and Tools read as
// siblings under the same dashboard nav bar. Extend `FORM_CARDS` when
// additional forms (W-4, 1099-NEC, W-7) become fillable.
const FORM_CARDS: readonly FormCardEntry[] = [
  {
    title: "IRS Form W-9",
    description:
      "Request for Taxpayer Identification Number and Certification.",
    // Land on the marketing landing (`/forms/w-9`) so the user sees
    // the "Fill out W-9 Form Online in {YEAR}" intermediate page with
    // its "Get Form" CTA, matching the flow QA expects (2026-08-30).
    // The landing's Get Form button navigates to
    // `ROUTES.FORMS.W9_EDIT` which loads the composer with the blank
    // template already bootstrapped. Previously linked
    // `ROUTES.FORMS.W9_SHORT` (`/w-9-form`) which skipped straight
    // into the editor.
    href: ROUTES.FORMS.W9,
    icon: File01Icon,
  },
];

const FORM_CARD_CLASSNAME =
  "group flex h-full w-full flex-col gap-4 rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] p-5 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2";

export function PvFormsGrid() {
  return (
    <section aria-label="Fillable forms">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FORM_CARDS.map((form) => (
          <li key={form.title} className="h-full">
            <Link className={FORM_CARD_CLASSNAME} href={form.href}>
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-[12px] bg-[var(--pv-tile)] text-[var(--pv-text-strong)]"
              >
                <HugeiconsIcon icon={form.icon} size={20} strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="pv-heading text-[17px] font-semibold leading-snug text-[var(--pv-text-strong)]">
                  {form.title}
                </p>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--pv-text-body)]">
                  {form.description}
                </p>
              </div>
              <span
                aria-hidden
                className="mt-auto inline-flex text-[var(--pv-text-strong)] transition-transform group-hover:translate-x-0.5"
              >
                <HugeiconsIcon icon={ArrowRight02Icon} size={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
