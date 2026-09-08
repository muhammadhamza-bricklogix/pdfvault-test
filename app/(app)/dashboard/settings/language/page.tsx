"use client";

import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore, useTransition } from "react";

import {
  PvFormRow,
  PvSectionHeading,
} from "@/components/sections/dashboard/settings/pv-settings-primitives";
import {
  buildLocaleHref,
  persistLangPref,
} from "@/components/shared/navigation/language-switcher";
import {
  type DateFormat,
  type Language,
  usePreferencesStore,
} from "@/lib/client/stores";
import {
  DEFAULT_LOCALE,
  type Locale,
  parseLocalePrefix,
} from "@/lib/shared/constants/locale-map";

const subscribe = () => () => {};
const useIsMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "ar", label: "العربية" },
];

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (04/27/2026)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (27/04/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-04-27)" },
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const selectClass =
  "h-11 w-full rounded-full border border-[var(--pv-hairline-strong)] bg-[var(--pv-surface)] px-4 text-[14px] text-[var(--pv-text-strong)] focus:border-[#7F56D9] focus:outline-none focus:ring-2 focus:ring-[#7F56D9]/20 disabled:opacity-60";

/**
 * Language & Region tab — same two-column PvFormRow rhythm as General /
 * Account. Persistence stays in the local Zustand preferences store; the
 * save is optimistic (no explicit Save button needed).
 */
export default function LanguageSettingsPage() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const dateFormat = usePreferencesStore((s) => s.dateFormat);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const setTimezone = usePreferencesStore((s) => s.setTimezone);
  const setDateFormat = usePreferencesStore((s) => s.setDateFormat);

  const hydrated = useIsMounted();
  const pathname = usePathname() ?? "/";
  const [pending, startTransition] = useTransition();

  // The source of truth for the active site language is the URL locale
  // prefix + `lang_pref` cookie (the same signals the LanguageSwitcher
  // and middleware use). Reading from the Zustand store here would
  // silently disagree with the rest of the site when the user picks a
  // language from the navbar switcher instead of Settings.
  const activeLocale: Locale =
    parseLocalePrefix(pathname)?.locale ?? DEFAULT_LOCALE;

  const timezoneOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);

    if (timezone) set.add(timezone);

    return Array.from(set).sort();
  }, [timezone]);

  const applyLanguage = (next: Language) => {
    if (next === activeLocale || pending) return;

    // Mirror the store so any future in-app reader stays in sync with
    // the URL/cookie decision — the store no longer drives the site
    // language, but keeping the two aligned prevents drift.
    setLanguage(next);
    persistLangPref(next);

    // Preserve current query string + hash so nested routes (e.g. the
    // settings sub-nav) keep any deep-link context after the reload.
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const href = buildLocaleHref(next, pathname, search, hash);

    // Hard navigation — matches the LanguageSwitcher pattern so the
    // Weglot SDK re-initialises on the new locale prefix and the site
    // renders in the chosen language on every subsequent route.
    startTransition(() => {
      window.location.assign(href);
    });
  };

  return (
    <section>
      <PvSectionHeading
        description="Saved automatically. Language applies across the entire site; timezone and date format apply only to this device for now."
        title="Language & Region"
      />

      <PvFormRow
        description="The language used across the PDFVault site. Changing this reloads the page in the new language."
        htmlFor="settings-language"
        label="Language"
      >
        <select
          className={selectClass}
          disabled={!hydrated || pending}
          id="settings-language"
          value={activeLocale}
          onChange={(e) => applyLanguage(e.target.value as Language)}
        >
          {LANGUAGES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </PvFormRow>

      <PvFormRow
        description="Used for timestamps on saved documents and activity."
        htmlFor="settings-timezone"
        label="Timezone"
      >
        <select
          className={selectClass}
          disabled={!hydrated}
          id="settings-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        >
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </PvFormRow>

      <PvFormRow
        last
        description="How dates appear across the app — pick the layout you prefer."
        htmlFor="settings-date-format"
        label="Date format"
      >
        <select
          className={selectClass}
          disabled={!hydrated}
          id="settings-date-format"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value as DateFormat)}
        >
          {DATE_FORMATS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </PvFormRow>
    </section>
  );
}
