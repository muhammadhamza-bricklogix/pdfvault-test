"use client";

import { ArrowRight02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Modal } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { stripLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";

interface FormEntry {
  slug: string;
  title: string;
  description: string;
  href: string;
  available: boolean;
}

const FORMS: readonly FormEntry[] = [
  {
    slug: "w-9",
    title: "IRS Form W-9",
    description:
      "Request for Taxpayer Identification Number and Certification.",
    href: ROUTES.FORMS.W9,
    available: true,
  },
  {
    slug: "1099-nec",
    title: "IRS Form 1099-NEC",
    description: "Report nonemployee compensation of $600 or more.",
    href: ROUTES.FORMS.NEC_1099,
    available: true,
  },
  {
    slug: "ds-11",
    title: "Form DS-11",
    description: "Apply for a U.S. passport book or passport card.",
    href: ROUTES.FORMS.DS11,
    available: true,
  },
  {
    slug: "ds-82",
    title: "Form DS-82",
    description:
      "Renew a U.S. passport by mail if yours is undamaged and was issued in the last 15 years.",
    href: ROUTES.FORMS.DS82,
    available: true,
  },
];

interface FormsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormsModal({ isOpen, onOpenChange }: FormsModalProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Locale-normalised path so `/de/forms/w-9` compares equal to
  // `/forms/w-9` when checking "am I already on this form".
  const strippedPath = stripLocalePrefix(pathname);

  useEffect(() => {
    // Auto-dismiss on route change — same pattern as AllTools modal so a
    // clicked tile navigates and closes the dialog behind it.

    onOpenChange(false);
  }, [pathname, onOpenChange]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="items-center justify-center p-4">
        <Modal.Dialog className="w-full max-w-[720px] rounded-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Fillable IRS Forms</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="max-h-[80vh] overflow-y-auto p-6">
            <p className="mb-5 text-[14px] leading-[20px] text-black/60">
              Choose a form to open the online editor. Fill it in your browser,
              sign, and export a clean PDF.
            </p>
            <ul className="flex flex-col gap-3">
              {FORMS.map((form) => {
                const inner = (
                  <>
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--pv-tile,#F3F3F3)] text-[var(--pv-text-strong,#121212)]"
                    >
                      <HugeiconsIcon
                        icon={File01Icon}
                        size={20}
                        strokeWidth={1.5}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 text-[15px] font-semibold text-[#121212]">
                        {form.title}
                        {form.available ? null : (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-black/50">
                            Coming soon
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 text-[13px] leading-snug text-black/60">
                        {form.description}
                      </span>
                    </span>
                    {form.available ? (
                      <span
                        aria-hidden
                        className="ml-2 inline-flex text-[var(--pv-text-strong,#121212)] transition-transform group-hover:translate-x-0.5"
                      >
                        <HugeiconsIcon icon={ArrowRight02Icon} size={18} />
                      </span>
                    ) : null}
                  </>
                );

                if (!form.available) {
                  return (
                    <li key={form.slug}>
                      <div className="group flex cursor-not-allowed items-center gap-3 rounded-[12px] border border-[var(--pv-hairline,#EAEAEA)] bg-white/60 p-4 opacity-70">
                        {inner}
                      </div>
                    </li>
                  );
                }

                // QA 2026-09-06: user is already on the target form's
                // route — the `<Link>` short-circuits (no pathname
                // change → auto-dismiss effect above never fires),
                // so the modal appears frozen and "nothing happens".
                // Intercept the click, close the modal, and
                // `router.refresh()` so the user gets an obvious
                // reset back to a fresh W-9 workspace. Compares
                // against the LOCALE-STRIPPED path so `/de/forms/w-9`
                // still recognises `form.href = "/forms/w-9"` as the
                // current route.
                const isCurrentRoute = strippedPath === form.href;

                return (
                  <li key={form.slug}>
                    <Link
                      className="group flex items-center gap-3 rounded-[12px] border border-[var(--pv-hairline,#EAEAEA)] bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong,#D6D6D6)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)]"
                      href={form.href}
                      onClick={(e) => {
                        if (isCurrentRoute) {
                          e.preventDefault();
                          onOpenChange(false);
                          router.refresh();
                        }
                      }}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
