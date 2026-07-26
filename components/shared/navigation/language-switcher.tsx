"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { useEffect, useState } from "react";

import { logger } from "@/lib/shared/utils/logger";

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
    logger.debug("[LanguageSwitcher] mounting");

    const onLangChange = (newLang: string) => {
      logger.debug("[LanguageSwitcher] languageChanged event:", newLang);
      setCurrentLang(newLang as LangCode);
    };

    const init = () => {
      const wgCurrent = window.Weglot?.getCurrentLang();

      logger.debug("[LanguageSwitcher] init — Weglot currentLang:", wgCurrent);
      setCurrentLang((wgCurrent as LangCode) ?? "en");
      window.Weglot?.on("languageChanged", onLangChange);
      setReady(true);
    };

    if (window.Weglot) {
      init();
    } else {
      logger.debug(
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
      {/* Mounted at the bottom of the dashboard sidebar — force the
          popover to open upward so the menu isn't clipped by the
          viewport edge. */}
      <Dropdown.Popover className="min-w-[140px]" placement="top">
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
                logger.debug(
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
                  logger.debug(
                    "[LanguageSwitcher] wrote to localStorage:",
                    lang.code,
                  );
                } catch (err) {
                  logger.error(
                    "[LanguageSwitcher] localStorage write failed:",
                    err,
                  );
                }
                logger.debug(
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
