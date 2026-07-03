"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { useEffect, useState } from "react";

type LangCode = "en" | "es";

const LANGUAGES = [
  { code: "en" as LangCode, label: "English", short: "EN" },
  { code: "es" as LangCode, label: "Español", short: "ES" },
] as const;

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<LangCode>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLangChange = (newLang: string) => {
      setCurrentLang(newLang as LangCode);
    };

    const init = () => {
      setCurrentLang((window.Weglot?.getCurrentLang() as LangCode) ?? "en");
      window.Weglot?.on("languageChanged", onLangChange);
      setReady(true);
    };

    if (window.Weglot) {
      init();
    } else {
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
              onAction={() => window.Weglot.switchTo(lang.code)}
            >
              <Label>{lang.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
