"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

export type Language = "en" | "es" | "fr" | "de" | "ja";

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
      language: "en",
      timezone: resolveDefaultTimezone(),
      dateFormat: "MM/DD/YYYY",
      setLanguage: (value) => set({ language: value }),
      setTimezone: (value) => set({ timezone: value }),
      setDateFormat: (value) => set({ dateFormat: value }),
    }),
    {
      name: "pdfedits:preferences",
    },
  ),
);
