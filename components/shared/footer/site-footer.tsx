import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

const COOKIE_SETTINGS_HREF = `${ROUTES.LEGAL.COOKIES}#managing-cookies`;

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
      { href: ROUTES.LEGAL.CONTACT, label: "Contact" },
      { href: ROUTES.PUBLIC.HOME, label: "Blog" },
    ],
    title: "Company",
  },
  {
    links: [
      { href: ROUTES.LEGAL.PRIVACY, label: "Privacy Policy" },
      { href: ROUTES.LEGAL.TERMS, label: "Terms & Conditions" },
      { href: ROUTES.LEGAL.COOKIES, label: "Cookie Policy" },
      { href: ROUTES.LEGAL.REFUND, label: "Refund Policy" },
      { href: ROUTES.LEGAL.DO_NOT_SELL, label: "Do not sell my info" },
      { href: COOKIE_SETTINGS_HREF, label: "Cookie settings" },
    ],
    title: "Legal",
  },
  {
    links: [
      { href: ROUTES.LEGAL.CONTACT, label: "Contact us" },
      { href: `${ROUTES.PUBLIC.HOME}#faq`, label: "FAQ" },
      { href: ROUTES.PUBLIC.PRICING, label: "Pricing" },
    ],
    title: "Help",
  },
  {
    links: [
      { href: ROUTES.AUTH.SIGN_IN, label: "Sign In" },
      { href: ROUTES.AUTH.SIGN_UP, label: "Register" },
      { href: ROUTES.LEGAL.CONTACT, label: "Unsubscribe" },
    ],
    title: "Account",
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-default-200 bg-background">
      <div className="mx-auto max-w-[min(100%,104rem)] px-6 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}-${link.label}`}>
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
            <Image alt="PDFedits" height={32} src="/logo.svg" width={32} />
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
