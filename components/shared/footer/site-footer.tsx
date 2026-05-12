"use client";

import Link from "next/link";

import { FooterLinkColumns } from "@/components/shared/footer/footer-link-columns";
import { FooterPaymentStrip } from "@/components/shared/footer/footer-payment-strip";
import {
  footerAffiliationDisclaimerClass,
  footerAffiliationDisclaimerTextClass,
  footerInnerContainerClass,
  footerLegalStripBlockClass,
  footerLegalStripLinkClass,
  footerPostCopyrightNavClass,
  footerShellClass,
} from "@/components/shared/footer/footer-styles";
import {
  FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINE_1,
  FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINE_2,
  FOOTER_POST_COPYRIGHT_NAV_LINKS,
  FOOTER_PRODUCT_COLUMN_TITLE,
  formatFooterCopyrightLine,
} from "@/lib/shared/constants/footer";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={footerShellClass}>
      <div className={footerInnerContainerClass}>
        <section
          aria-label={`${FOOTER_PRODUCT_COLUMN_TITLE}, Help, and Account`}
        >
          <FooterLinkColumns />
        </section>

        <div className={footerLegalStripBlockClass}>
          <p>{formatFooterCopyrightLine(year)}</p>
          <nav
            aria-label="Legal policies"
            className={footerPostCopyrightNavClass}
          >
            {FOOTER_POST_COPYRIGHT_NAV_LINKS.map((item, index) => (
              <span
                key={item.href}
                className="inline-flex flex-wrap items-center"
              >
                {index > 0 ? (
                  <span aria-hidden className="px-1.5 text-default-400">
                    ·
                  </span>
                ) : null}
                <Link className={footerLegalStripLinkClass} href={item.href}>
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
          <div className={footerAffiliationDisclaimerClass}>
            <p className={footerAffiliationDisclaimerTextClass}>
              {FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINE_1}
              <br />
              {FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINE_2}
            </p>
          </div>
        </div>

        <FooterPaymentStrip />
      </div>
    </footer>
  );
}
