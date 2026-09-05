"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  buildLocaleHref,
  persistLangPref,
} from "@/components/shared/navigation/language-switcher";
import {
  DEFAULT_LOCALE,
  type Locale,
  parseLocalePrefix,
} from "@/lib/shared/constants/locale-map";

type Entry = { code: Locale; label: string; short: string };

const LANGUAGES: Entry[] = [
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
 * Landing-page language switcher. Derives the current locale from the
 * URL prefix (`/de/…`, `/fr/…`) and navigates to the equivalent URL
 * under the chosen locale on click. Writes `lang_pref` so subsequent
 * visits skip the geo redirect. Weglot's client SDK picks up the URL
 * change and translates the DOM.
 */
export function LandingLanguageSwitcher({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname() ?? "/";
  const activeLocale =
    (parseLocalePrefix(pathname)?.locale as Locale | undefined) ??
    DEFAULT_LOCALE;
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const current =
    LANGUAGES.find((lang) => lang.code === activeLocale) ?? LANGUAGES[0];

  const select = (code: Locale) => {
    setOpen(false);
    if (code === activeLocale) return;
    persistLangPref(code);
    // Preserve query + hash so marketing UTM / referral params (and
    // any deep-link state on `/all-tools`, `/pricing`, etc.) survive
    // the locale change. Matches the composer-side fix in
    // `LanguageSwitcher`.
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const href = buildLocaleHref(code, pathname, search, hash);

    startTransition(() => {
      // Hard navigation so Weglot's SDK re-initializes on the new
      // locale prefix. Soft router.push keeps the same window and
      // Weglot never re-runs its translation pass.
      window.location.assign(href);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Select language"
        className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)] disabled:opacity-50"
        disabled={pending}
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
              aria-checked={lang.code === activeLocale}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-section-gray)] focus-visible:bg-[var(--pv-section-gray)] focus-visible:outline-none"
              role="menuitemradio"
              type="button"
              onClick={() => select(lang.code)}
            >
              <span
                className={lang.code === activeLocale ? "font-semibold" : ""}
              >
                {lang.label}
              </span>
              {lang.code === activeLocale ? <CheckIcon /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
