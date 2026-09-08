"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type Locale,
} from "@/lib/shared/constants/locale-map";

export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

// Language is the app's supported set of site locales (en/de/fr/es/pt/ar).
// Kept as a re-export so downstream consumers can import `Language` from
// the store without needing to know the locale-map path.
export type Language = Locale;

type PreferencesState = {
  language: Language;
  timezone: string;
  dateFormat: DateFormat;
  setLanguage: (value: Language) => void;
  setTimezone: (value: string) => void;
  setDateFormat: (value: DateFormat) => void;
};

const resolveDefaultTimezone = () => {
  if (typeof window === "undefined") return "UTC";

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: DEFAULT_LOCALE,
      timezone: resolveDefaultTimezone(),
      dateFormat: "MM/DD/YYYY",
      setLanguage: (value) => set({ language: value }),
      setTimezone: (value) => set({ timezone: value }),
      setDateFormat: (value) => set({ dateFormat: value }),
    }),
    {
      name: "pdfedits:preferences",
      // Migrate rows persisted before the site's locale set (en/de/fr/es/pt/ar)
      // was the source of truth. The prior list included "ja" which was never
      // an actual site locale — coerce any legacy value back to the default so
      // the settings <select> doesn't render a stale/broken option.
      migrate: (state) => {
        const s = (state ?? {}) as Partial<PreferencesState>;

        if (!isSupportedLocale(s.language)) {
          return { ...s, language: DEFAULT_LOCALE } as PreferencesState;
        }

        return s as PreferencesState;
      },
      version: 1,
    },
  ),
);
