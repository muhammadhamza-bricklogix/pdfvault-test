"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import {
  DEFAULT_LOCALE,
  LANG_PREF_COOKIE,
  type Locale,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

type Entry = { code: Locale; label: string; short: string };

const LANGUAGES: Entry[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "pt", label: "Português", short: "PT" },
  { code: "ar", label: "العربية", short: "AR" },
];

function buildLocaleHref(nextLocale: Locale, pathname: string): string {
  const parsed = parseLocalePrefix(pathname);
  const strippedPath = parsed ? parsed.rest : pathname;
  const suffix = strippedPath === "/" ? "" : strippedPath;

  if (nextLocale === DEFAULT_LOCALE) return suffix || "/";

  return `/${nextLocale}${suffix}`;
}

function persistLangPref(nextLocale: Locale) {
  try {
    const attrs = [
      `${LANG_PREF_COOKIE}=${nextLocale}`,
      "Path=/",
      "Max-Age=31536000",
      "SameSite=Lax",
    ];

    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:"
    ) {
      attrs.push("Secure");
    }
    document.cookie = attrs.join("; ");
  } catch {
    // Storage disabled — no-op. The next server response will re-run
    // geo defaulting, which is safe fallback behaviour.
  }
}

function localeFromPathname(pathname: string): Locale {
  return parseLocalePrefix(pathname)?.locale ?? DEFAULT_LOCALE;
}

export function LanguageSwitcher() {
  const pathname = usePathname() ?? "/";
  const activeLocale = localeFromPathname(pathname);
  const [pending, startTransition] = useTransition();
  const current =
    LANGUAGES.find((lang) => lang.code === activeLocale) ?? LANGUAGES[0];

  return (
    <Dropdown>
      <Button
        className="gap-1 font-medium text-default-600 dark:text-default-400"
        isDisabled={pending}
        size="sm"
        variant="ghost"
      >
        🌐 {current.short}
      </Button>
      {/* Mounted at the bottom of the dashboard sidebar — force the
          popover to open upward so the menu isn't clipped by the
          viewport edge. */}
      <Dropdown.Popover className="min-w-[140px]" placement="top">
        <Dropdown.Menu
          aria-label="Select language"
          selectedKeys={new Set([activeLocale])}
          selectionMode="single"
        >
          {LANGUAGES.map((lang) => (
            <Dropdown.Item
              key={lang.code}
              id={lang.code}
              textValue={lang.label}
              onAction={() => {
                if (lang.code === activeLocale) return;
                persistLangPref(lang.code);
                const href = buildLocaleHref(lang.code, pathname);

                startTransition(() => {
                  // Hard navigation so Weglot's SDK re-initializes on the
                  // new locale prefix. Soft router.push keeps the same
                  // window and Weglot never re-runs its translation pass.
                  window.location.assign(href);
                });
              }}
            >
              <Label>{lang.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

// Re-exported so downstream code that used to compose Weglot-driven
// state can share the same helpers.
export {
  SUPPORTED_LOCALES as LANGUAGE_SWITCHER_LOCALES,
  buildLocaleHref,
  persistLangPref,
};
