"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  type DateFormat,
  type Language,
  usePreferencesStore,
} from "@/lib/client/stores";

const subscribe = () => () => { };
const useIsMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
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

const fieldClass =
  "w-full rounded-md border border-default-200 bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

export default function LanguageSettingsPage() {
  const language = usePreferencesStore((s) => s.language);
  const timezone = usePreferencesStore((s) => s.timezone);
  const dateFormat = usePreferencesStore((s) => s.dateFormat);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const setTimezone = usePreferencesStore((s) => s.setTimezone);
  const setDateFormat = usePreferencesStore((s) => s.setDateFormat);

  // Avoid hydration mismatch from persisted localStorage values.
  const hydrated = useIsMounted();

  const timezoneOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);

    if (timezone) set.add(timezone);

    return Array.from(set).sort();
  }, [timezone]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          Language &amp; Region
        </h2>
        <p className="text-sm text-default-500">
          Saved automatically. These preferences apply only to this device for
          now.
        </p>
      </header>

      <div className="flex flex-col gap-5 rounded-xl border border-default-200 bg-[var(--color-background)] p-5">
        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-[var(--color-foreground)]"
            htmlFor="lang-select"
          >
            Language
          </label>
          <select
            className={fieldClass}
            disabled={!hydrated}
            id="lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-[var(--color-foreground)]"
            htmlFor="tz-select"
          >
            Timezone
          </label>
          <select
            className={fieldClass}
            disabled={!hydrated}
            id="tz-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-[var(--color-foreground)]"
            htmlFor="date-select"
          >
            Date format
          </label>
          <select
            className={fieldClass}
            disabled={!hydrated}
            id="date-select"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as DateFormat)}
          >
            {DATE_FORMATS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
