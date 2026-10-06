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
