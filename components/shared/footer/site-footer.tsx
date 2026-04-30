import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

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
  return (
    <footer className="border-t border-default-200 bg-background">
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
                      className="text-sm text-default-500 transition-colors hover:text-foreground"
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

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-default-200 pt-8 sm:flex-row sm:justify-between">
          <Link className="flex items-center gap-2" href={ROUTES.PUBLIC.HOME}>
            <Image
              alt="PDFedits"
              height={32}
              src="/logo.svg"
              width={32}
            />
            <span className="text-lg font-semibold tracking-tight">
              <span className="text-[var(--color-accent)]">PDF</span>
              <span className="text-[var(--color-foreground)]">edits</span>
            </span>
          </Link>
          <p className="text-sm text-default-500">
            &copy; {new Date().getFullYear()} PDFedits. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
