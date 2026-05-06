import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

export function LegalMiniFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-[var(--legal-border-subtle)] pt-8 text-center text-xs text-[var(--legal-text-muted)]">
      <p>
        © {year} PDF Viewer App ·{" "}
        <Link
          className="font-medium text-[var(--legal-burgundy)] underline-offset-2 hover:underline"
          href={ROUTES.LEGAL.PRIVACY}
        >
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link
          className="font-medium text-[var(--legal-burgundy)] underline-offset-2 hover:underline"
          href={ROUTES.LEGAL.TERMS}
        >
          Terms &amp; Conditions
        </Link>{" "}
        ·{" "}
        <Link
          className="font-medium text-[var(--legal-burgundy)] underline-offset-2 hover:underline"
          href={ROUTES.LEGAL.COOKIES}
        >
          Cookie Policy
        </Link>{" "}
        · pdfedits.io
      </p>
    </footer>
  );
}
