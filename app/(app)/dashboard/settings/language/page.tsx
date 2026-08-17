"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  PvFormRow,
  PvSectionHeading,
} from "@/components/sections/dashboard/settings/pv-settings-primitives";
import {
  type DateFormat,
  type Language,
  usePreferencesStore,
} from "@/lib/client/stores";

const subscribe = () => () => {};
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

const selectClass =
  "h-11 w-full rounded-full border border-[var(--pv-hairline-strong)] bg-[var(--pv-surface)] px-4 text-[14px] text-[var(--pv-text-strong)] focus:border-[#7F56D9] focus:outline-none focus:ring-2 focus:ring-[#7F56D9]/20 disabled:opacity-60";

/**
 * Language & Region tab — same two-column PvFormRow rhythm as General /
 * Account. Persistence stays in the local Zustand preferences store; the
 * save is optimistic (no explicit Save button needed).
 */
export default function LanguageSettingsPage() {
  const language = usePreferencesStore((s) => s.language);
  const timezone = usePreferencesStore((s) => s.timezone);
  const dateFormat = usePreferencesStore((s) => s.dateFormat);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const setTimezone = usePreferencesStore((s) => s.setTimezone);
  const setDateFormat = usePreferencesStore((s) => s.setDateFormat);

  const hydrated = useIsMounted();

  const timezoneOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);

    if (timezone) set.add(timezone);

    return Array.from(set).sort();
  }, [timezone]);

  return (
    <section>
      <PvSectionHeading
        description="Saved automatically. These preferences apply only to this device for now."
        title="Language & Region"
      />

      <PvFormRow
        description="The language used for the PDFVault interface on this device."
        htmlFor="settings-language"
        label="Language"
      >
        <select
          className={selectClass}
          disabled={!hydrated}
          id="settings-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
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
