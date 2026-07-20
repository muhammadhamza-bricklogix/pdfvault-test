"use client";

import { useEffect, useRef, useState } from "react";

import { WEGLOT_LANG_STORAGE_KEY } from "@/components/shared/navigation/weglot-loader";

type LangCode = "en" | "es" | "ar" | "fr" | "de" | "pt";

// Must match the `destinationLanguages` list in `weglot-loader.tsx` and
// the hreflang alternates in `app/layout.tsx`. Order shown here is the
// order the dropdown renders.
const LANGUAGES: { code: LangCode; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "pt", label: "Português", short: "PT" },
  { code: "ar", label: "العربية", short: "AR" },
];

function GlobeIcon() {
  return (
    <svg aria-hidden fill="none" height="18" viewBox="0 0 20 20" width="18">
      <circle
        cx="10"
        cy="10"
        r="7.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2.75 10h14.5M10 2.75c2 2 2 12.5 0 14.5M10 2.75c-2 2-2 12.5 0 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      className="text-[var(--pv-brand-primary)]"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path
        d="M3.5 8.5l3 3 6-6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Landing-page language switcher, wired to the Weglot global loaded by
 * `WeglotLoader`. Styled to match the PDFVault landing header (not the HeroUI
 * app switcher). Reflects the live Weglot language and switches via
 * `window.Weglot.switchTo`. Disabled until Weglot has initialised.
 */
export function LandingLanguageSwitcher({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const [currentLang, setCurrentLang] = useState<LangCode>("en");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onLangChange = (newLang: string) => {
      setCurrentLang((newLang as LangCode) ?? "en");
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

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  const select = (code: LangCode) => {
    // Belt-and-braces: persist to localStorage synchronously here in
    // addition to the `languageChanged` listener in WeglotLoader. Some
    // Weglot builds don't fire `languageChanged` when the target
    // matches the current cookie, so relying on that alone can leave
    // localStorage stale between page reloads.
    try {
      window.localStorage.setItem(WEGLOT_LANG_STORAGE_KEY, code);
    } catch {
      // ignore private-mode / storage-disabled
    }
    window.Weglot?.switchTo(code);
    // Reflect the picked code immediately in local state so the
    // dropdown label updates even if Weglot's own event is delayed.
    setCurrentLang(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Select language"
        className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)] disabled:opacity-50"
        disabled={!ready}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon />
        {current.short}
        <ChevronDown open={open} />
      </button>
      {open ? (
        <div
          className={`absolute top-[calc(100%+8px)] z-30 min-w-[160px] rounded-xl border border-[var(--pv-card-border)] bg-white p-1.5 shadow-lg ${
            variant === "mobile" ? "left-0" : "right-0"
          }`}
          role="menu"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              aria-checked={lang.code === currentLang}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-section-gray)] focus-visible:bg-[var(--pv-section-gray)] focus-visible:outline-none"
              role="menuitemradio"
              type="button"
              onClick={() => select(lang.code)}
            >
              <span
                className={lang.code === currentLang ? "font-semibold" : ""}
              >
                {lang.label}
              </span>
              {lang.code === currentLang ? <CheckIcon /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
