import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

const POLICY_LINKS = [
  {
    description: "Rules for using PDFedits and our services at pdfedits.io",
    href: ROUTES.LEGAL.TERMS,
    label: "Terms & Conditions",
  },
  {
    description: "How we collect, use, and protect personal information",
    href: ROUTES.LEGAL.PRIVACY,
    label: "Privacy Policy",
  },
  {
    description: "Cookies, local storage, and how to manage preferences",
    href: ROUTES.LEGAL.COOKIES,
    label: "Cookie Policy",
  },
  {
    description: "Money-back guarantee, renewals, and how to request a refund",
    href: ROUTES.LEGAL.REFUND,
    label: "Refund Policy",
  },
  {
    description: "CCPA/CPRA opt-out and state privacy rights",
    href: ROUTES.LEGAL.DO_NOT_SELL,
    label: "Do not sell or share my information",
  },
  {
    description: "Reach our team — we typically reply within 24 hours",
    href: ROUTES.LEGAL.CONTACT,
    label: "Contact us",
  },
];

export default function LegalSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          Legal & policies
        </h2>
        <p className="text-sm text-default-500">
          Review our policies and get in touch. The same pages are linked in the
          site footer.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {POLICY_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              className="block rounded-xl border border-default-200 bg-[var(--color-background)] p-4 transition-colors hover:border-default-300 hover:bg-default-100/50"
              href={item.href}
            >
              <span className="block text-sm font-semibold text-[var(--color-foreground)]">
                {item.label}
              </span>
              <span className="mt-1 block text-xs text-default-500">
                {item.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
