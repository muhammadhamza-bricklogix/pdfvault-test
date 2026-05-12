"use client";

import Image from "next/image";
import Link from "next/link";

import { FooterLinkColumns } from "@/components/shared/footer/footer-link-columns";
import { FooterPaymentStrip } from "@/components/shared/footer/footer-payment-strip";
import {
  footerAffiliationDisclaimerClass,
  footerCompanyBlockClass,
  footerCompanyEntityClass,
  footerCompanyPlaceholderClass,
  footerInnerContainerClass,
  footerLegalStripBlockClass,
  footerLegalStripLinkClass,
  footerLogoAccentClass,
  footerLogoLinkClass,
  footerLogoRestClass,
  footerLogoRowClass,
  footerLogoWordmarkClass,
  footerPostCopyrightNavClass,
  footerShellClass,
} from "@/components/shared/footer/footer-styles";
import {
  FOOTER_BRAND_NAME,
  FOOTER_COMPANY_ADDRESS_PLACEHOLDER,
  FOOTER_COMPANY_ENTITY,
  FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINES,
  FOOTER_LEGAL_STRIP_LINKS,
  FOOTER_POST_COPYRIGHT_NAV_LINKS,
  FOOTER_PRODUCT_COLUMN_TITLE,
  FOOTER_PUBLIC_DOMAIN,
} from "@/lib/shared/constants/footer";
import { ROUTES } from "@/lib/shared/constants/routes";

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

        <div className={footerCompanyBlockClass}>
          <p className={footerCompanyEntityClass}>{FOOTER_COMPANY_ENTITY}</p>
          <p className={footerCompanyPlaceholderClass}>
            {FOOTER_COMPANY_ADDRESS_PLACEHOLDER}
          </p>
        </div>

        <div className={footerLegalStripBlockClass}>
          <p>
            &copy; {year} {FOOTER_BRAND_NAME} ·{" "}
            {FOOTER_LEGAL_STRIP_LINKS.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? <> · </> : null}
                <Link className={footerLegalStripLinkClass} href={item.href}>
                  {item.label}
                </Link>
              </span>
            ))}{" "}
            · {FOOTER_PUBLIC_DOMAIN} · All rights reserved.
          </p>
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
            {FOOTER_GOVERNMENT_AFFILIATION_DISCLAIMER_LINES.map(
              (line, index) => (
                <p key={`footer-affiliation-line-${index}`} className="m-0">
                  {line}
                </p>
              ),
            )}
          </div>
        </div>

        <FooterPaymentStrip />
      </div>
    </footer>
  );
}
