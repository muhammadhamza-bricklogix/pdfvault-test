"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

type LocaleKey = "de" | "fr" | "es" | "pt" | "ar";

type Props = {
  ar?: ReactNode;
  as?: "span" | "div" | "p" | "h2" | "h3" | "h4" | "li" | "strong" | "em";
  className?: string;
  de?: ReactNode;
  es?: ReactNode;
  fr?: ReactNode;
  pt?: ReactNode;
  children: ReactNode;
};

/**
 * Renders a per-locale override wrapped in a `wg-notranslate` fence so
 * Weglot leaves it untouched. For locales without an override the
 * children are rendered as-is, letting Weglot's SDK produce its machine
 * translation like it does everywhere else.
 *
 * Use when Weglot's machine output has a QA-flagged defect that can't
 * be corrected on the merchant dashboard: write the correct phrase in
 * German (or whichever locale) and pass it via the `de` prop while
 * leaving the English source in `children` for everyone else.
 */
export function LocaleText({
  ar,
  as: As = "span",
  children,
  className,
  de,
  es,
  fr,
  pt,
}: Props) {
  const pathname = usePathname();
  const seg = pathname?.split("/")[1] as LocaleKey | undefined;
  const override = seg ? { ar, de, es, fr, pt }[seg] : undefined;

  if (override !== undefined && override !== null) {
    return (
      <As
        className={
          className
            ? `${className} notranslate wg-notranslate`
            : "notranslate wg-notranslate"
        }
        translate="no"
      >
        {override}
      </As>
    );
  }

  if (className) {
    return <As className={className}>{children}</As>;
  }

  return <>{children}</>;
}
