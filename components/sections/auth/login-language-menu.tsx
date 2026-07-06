"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Compact language control for the login header: `🌐 EN ▾`. English-only for
 * now (the product ships one locale), but built as an accessible menu shell so
 * additional locales can be wired in later without markup changes.
 */
export function LoginLanguageMenu() {
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

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Select language"
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[14px] text-[#1a1c21] transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
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
        EN
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
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[140px] rounded-xl border border-[#e9ecef] bg-white p-1.5 shadow-lg"
          role="menu"
        >
          <button
            aria-checked
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] font-medium text-[#1a1c21] transition-colors hover:bg-[#f5f5f5] focus-visible:bg-[#f5f5f5] focus-visible:outline-none"
            role="menuitemradio"
            type="button"
            onClick={() => setOpen(false)}
          >
            English
          </button>
        </div>
      ) : null}
    </div>
  );
}
