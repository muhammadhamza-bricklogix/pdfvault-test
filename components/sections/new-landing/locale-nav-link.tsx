"use client";

import type { ComponentProps } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { parseLocalePrefix } from "@/lib/shared/constants/locale-map";

type Locale = NonNullable<ReturnType<typeof parseLocalePrefix>>["locale"];

/** Non-default locale of the current route, or null on English routes. */
export function useRouteLocale(): Locale | null {
  const pathname = usePathname();

  return parseLocalePrefix(pathname ?? "/")?.locale ?? null;
}

function isInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/** Prefixes an internal path with the locale unless it already has one. */
export function localizeHref(href: string, locale: Locale | null): string {
  if (!locale || !isInternalPath(href) || parseLocalePrefix(href)) return href;

  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

type LocaleNavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/**
 * `next/link` on English routes. On other locales a plain anchor to the
 * prefixed URL, because Weglot only translates pages on a full load.
 */
export function LocaleNavLink(props: LocaleNavLinkProps) {
  const routeLocale = useRouteLocale();

  if (!routeLocale || !isInternalPath(props.href)) return <Link {...props} />;

  const {
    href,
    prefetch: _prefetch,
    replace: _replace,
    scroll: _scroll,
    shallow: _shallow,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    locale: _locale,
    onNavigate: _onNavigate,
    ...anchorProps
  } = props;

  return <a {...anchorProps} href={localizeHref(href, routeLocale)} />;
}
