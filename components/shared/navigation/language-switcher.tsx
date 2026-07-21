/* eslint-disable no-console */
"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { useEffect, useState } from "react";

import { WEGLOT_LANG_STORAGE_KEY } from "./weglot-loader";

type LangCode = "en" | "es" | "ar" | "fr" | "de" | "pt";

// Must match `destinationLanguages` in weglot-loader.tsx + hreflang
// alternates in app/layout.tsx.
const LANGUAGES = [
  { code: "en" as LangCode, label: "English", short: "EN" },
  { code: "es" as LangCode, label: "Español", short: "ES" },
  { code: "fr" as LangCode, label: "Français", short: "FR" },
  { code: "de" as LangCode, label: "Deutsch", short: "DE" },
  { code: "pt" as LangCode, label: "Português", short: "PT" },
  { code: "ar" as LangCode, label: "العربية", short: "AR" },
] as const;

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<LangCode>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log("[LanguageSwitcher] mounting");

    const onLangChange = (newLang: string) => {
      console.log("[LanguageSwitcher] languageChanged event:", newLang);
      setCurrentLang(newLang as LangCode);
    };

    const init = () => {
      const wgCurrent = window.Weglot?.getCurrentLang();

      console.log("[LanguageSwitcher] init — Weglot currentLang:", wgCurrent);
      setCurrentLang((wgCurrent as LangCode) ?? "en");
      window.Weglot?.on("languageChanged", onLangChange);
      setReady(true);
    };

    if (window.Weglot) {
      init();
    } else {
      console.log(
        "[LanguageSwitcher] Weglot not ready — waiting for weglot:initialized",
      );
      window.addEventListener("weglot:initialized", init, { once: true });
    }

    return () => {
      window.removeEventListener("weglot:initialized", init);
      window.Weglot?.off("languageChanged", onLangChange);
    };
  }, []);

  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  return (
    <Dropdown>
      <Button
        className="gap-1 font-medium text-default-600 dark:text-default-400"
        isDisabled={!ready}
        size="sm"
        variant="ghost"
      >
        🌐 {current.short}
      </Button>
      <Dropdown.Popover className="min-w-[140px]">
        <Dropdown.Menu
          aria-label="Select language"
          selectedKeys={new Set([currentLang])}
          selectionMode="single"
        >
          {LANGUAGES.map((lang) => (
            <Dropdown.Item
              key={lang.code}
              id={lang.code}
              textValue={lang.label}
              onAction={() => {
                console.log(
                  "[LanguageSwitcher] user selected language:",
                  lang.code,
                );
                // Persist synchronously so localStorage stays fresh
                // even if Weglot's `languageChanged` event is delayed
                // or skipped on same-language switches.
                try {
                  window.localStorage.setItem(
                    WEGLOT_LANG_STORAGE_KEY,
                    lang.code,
                  );
                  console.log(
                    "[LanguageSwitcher] wrote to localStorage:",
                    lang.code,
                  );
                } catch (err) {
                  console.error(
                    "[LanguageSwitcher] localStorage write failed:",
                    err,
                  );
                }
                console.log(
                  "[LanguageSwitcher] calling Weglot.switchTo:",
                  lang.code,
                );
                window.Weglot?.switchTo(lang.code);
                setCurrentLang(lang.code);
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
