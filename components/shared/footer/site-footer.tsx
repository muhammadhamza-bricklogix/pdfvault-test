"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

const HIDE_FOOTER_PREFIXES = [ROUTES.APP.DASHBOARD, ROUTES.TOOLS.PDF_EDITOR];

function shouldHideFooter(pathname: string | null): boolean {
  if (!pathname) return false;

  return HIDE_FOOTER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const FOOTER_COLUMNS = [
  {
    links: [
      { href: ROUTES.TOOLS.PDF_EDITOR, label: "PDF Editor" },
      { href: ROUTES.PUBLIC.HOME, label: "Compress PDF" },
      { href: ROUTES.PUBLIC.HOME, label: "Convert PDF" },
      { href: ROUTES.PUBLIC.HOME, label: "Protect PDF" },
    ],
    title: "Product",
  },
  {
    links: [
      { href: ROUTES.PUBLIC.HOME, label: "About" },
      { href: ROUTES.PUBLIC.HOME, label: "Contact" },
      { href: ROUTES.PUBLIC.HOME, label: "Blog" },
    ],
    title: "Company",
  },
  {
    links: [
      { href: ROUTES.PUBLIC.HOME, label: "Privacy Policy" },
      { href: ROUTES.PUBLIC.HOME, label: "Terms of Service" },
    ],
    title: "Legal",
  },
];

export function SiteFooter() {
  const pathname = usePathname();

  if (shouldHideFooter(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-[var(--app-border)] bg-[var(--color-background)]">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      className="text-sm text-[var(--app-muted)] transition-colors hover:text-[var(--color-foreground)]"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-[var(--app-border)] pt-8 sm:flex-row sm:justify-between">
          <Link
            className="text-lg font-semibold tracking-tight"
            href={ROUTES.PUBLIC.HOME}
          >
            <span className="text-[var(--color-accent)]">pdf</span>
            <span className="text-[var(--color-foreground)]">forge</span>
          </Link>
          <p className="text-sm text-[var(--app-muted)]">
            &copy; {new Date().getFullYear()} PDFForge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
