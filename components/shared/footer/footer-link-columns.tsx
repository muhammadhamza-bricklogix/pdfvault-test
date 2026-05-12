import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  File01Icon,
  NoteIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { FooterAsideColumnHeading } from "@/components/shared/footer/footer-aside-column-heading";
import {
  footerLinkClass,
  footerLinkColumnListClass,
  footerLinkViewAllClass,
  footerMainColumnsGridClass,
  footerSubsectionHeadingClass,
  footerSubsectionIconWrapClass,
  footerSubsectionTitleStackClass,
} from "@/components/shared/footer/footer-styles";
import {
  FOOTER_COLUMNS,
  FOOTER_EDIT_PDF_SUBSECTION_TITLE,
  FOOTER_PRODUCT_SUBSECTIONS,
} from "@/lib/shared/constants/footer";

const SECTION_ICONS = {
  [FOOTER_EDIT_PDF_SUBSECTION_TITLE]: File01Icon,
  "Convert from PDF": ArrowDown01Icon,
  "Convert to PDF": ArrowUp01Icon,
  Forms: NoteIcon,
} as const;

function isViewAllLinkLabel(label: string) {
  return label === "View all" || label.startsWith("View all ");
}

export function FooterLinkColumns() {
  return (
    <div className={footerMainColumnsGridClass}>
      {FOOTER_PRODUCT_SUBSECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.title as keyof typeof SECTION_ICONS];

        return (
          <div key={section.title}>
            <div className={footerSubsectionTitleStackClass}>
              {Icon ? (
                <span className={footerSubsectionIconWrapClass}>
                  <HugeiconsIcon aria-hidden icon={Icon} size={18} />
                </span>
              ) : null}
              <h4 className={footerSubsectionHeadingClass}>{section.title}</h4>
            </div>
            <ul className={footerLinkColumnListClass}>
              {section.links.map((link) => (
                <li key={`${section.title}-${link.label}-${link.href}`}>
                  <Link
                    className={
                      isViewAllLinkLabel(link.label)
                        ? footerLinkViewAllClass
                        : footerLinkClass
                    }
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {FOOTER_COLUMNS.map((column) => (
        <div key={column.title}>
          <FooterAsideColumnHeading
            asideIcon={column.asideIcon}
            title={column.title}
          />
          <ul className={footerLinkColumnListClass}>
            {column.links.map((link) => (
              <li key={`${column.title}-${link.href}-${link.label}`}>
                <Link className={footerLinkClass} href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
