import Link from "next/link";

import { footerLegalMiniFooterLinkClass } from "@/components/shared/footer/footer-styles";
import {
  FOOTER_BRAND_NAME,
  FOOTER_LEGAL_STRIP_LINKS,
  FOOTER_PUBLIC_DOMAIN,
} from "@/lib/shared/constants/footer";

export function LegalMiniFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-[var(--legal-border-subtle)] pt-8 text-center text-xs text-[var(--legal-text-muted)]">
      <p>
        © {year} {FOOTER_BRAND_NAME} ·{" "}
        {FOOTER_LEGAL_STRIP_LINKS.map((item, index) => (
          <span key={item.href}>
            {index > 0 ? <> · </> : null}
            <Link className={footerLegalMiniFooterLinkClass} href={item.href}>
              {item.label}
            </Link>
          </span>
        ))}{" "}
        · {FOOTER_PUBLIC_DOMAIN}
      </p>
    </footer>
  );
}
