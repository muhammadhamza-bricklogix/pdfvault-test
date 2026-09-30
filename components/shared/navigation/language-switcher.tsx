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
import { ROUTES } from "@/lib/shared/constants/routes";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";

type Entry = { code: Locale; label: string; short: string };

const LANGUAGES: Entry[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "pt", label: "Português", short: "PT" },
  { code: "ar", label: "العربية", short: "AR" },
];

function buildLocaleHref(
  nextLocale: Locale,
  pathname: string,
  search = "",
  hash = "",
): string {
  const parsed = parseLocalePrefix(pathname);
  const strippedPath = parsed ? parsed.rest : pathname;
  const suffix = strippedPath === "/" ? "" : strippedPath;
  // Preserve the current query string + hash so callers on
  // `/pdf-composer?id=<docId>&tool=<slug>` don't lose their in-flight
  // context when switching locales. Without this the editor lost its
  // `?id=` on every language change and either bounced the user to
  // Dashboard (post-signin path) or fell back to an empty drop-zone —
  // reported by QA 2026-09-05.
  const suffixWithQuery = `${suffix}${search ?? ""}${hash ?? ""}`;

  if (nextLocale === DEFAULT_LOCALE) return suffixWithQuery || "/";

  return `/${nextLocale}${suffixWithQuery}`;
}

// Composer routes where an unsaved editor session lives in memory. On
// these routes we snapshot `file + fabricJsonByPage + extractedPages`
// to IDB BEFORE the locale full-page reload so
// `PendingEditorFileHydrator` restores the exact state after Weglot
// re-initialises on the new locale. Every other route restores from
// the URL alone (marketing pages, dashboard, etc.) so no snapshot is
// needed. Keep the set minimal — snapshotting on every language click
// on the marketing landing would just churn IDB for no gain.
const EDITOR_ROUTES_NEEDING_SNAPSHOT: ReadonlySet<string> = new Set([
  ROUTES.TOOLS.PDF_EDITOR, // "/pdf-composer"
  "/pdf-editor",
  ROUTES.FORMS.W9_SHORT, // "/w-9-form"
  ROUTES.FORMS.NEC_1099_EDIT, // "/forms/1099-nec/edit"
]);

function needsEditorSnapshot(pathname: string): boolean {
  const parsed = parseLocalePrefix(pathname);
  const strippedPath = parsed ? parsed.rest : pathname;

  return EDITOR_ROUTES_NEEDING_SNAPSHOT.has(strippedPath);
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

                // Preserve `?id=<docId>&tool=<slug>&export=<fmt>` +
                // any hash. The composer + W-9 routes rely on those
                // params to re-hydrate the exact editor state after
                // Weglot's mandatory full-page reload; stripping them
                // would strand the user on an empty drop-zone or
                // bounce them to Dashboard (QA 2026-09-05).
                const search =
                  typeof window !== "undefined" ? window.location.search : "";
                const hash =
                  typeof window !== "undefined" ? window.location.hash : "";
                const href = buildLocaleHref(lang.code, pathname, search, hash);

                // Editor routes: snapshot the in-memory file + fabric
                // overlays + extractedPages to IDB before the reload
                // so `PendingEditorFileHydrator` restores them on the
                // fresh page. Signed-in users with a `?id=` in the
                // URL are already covered by the document loader, but
                // signed-out users editing locally OR signed-in users
                // with unsaved fabric edits both lose work without
                // this snapshot. Fire-and-forget — snapshot failure
                // shouldn't block the language change.
                const snapshotPromise = needsEditorSnapshot(pathname)
                  ? snapshotPendingEditorFile().catch(() => undefined)
                  : Promise.resolve();

                startTransition(() => {
                  // Wait for the snapshot to hit disk (typically < 50 ms)
                  // before firing the reload; skip on non-editor routes.
                  void snapshotPromise.then(() => {
                    // Hard navigation so Weglot's SDK re-initializes on
                    // the new locale prefix. Soft router.push keeps the
                    // same window and Weglot never re-runs its
                    // translation pass.
                    window.location.assign(href);
                  });
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
