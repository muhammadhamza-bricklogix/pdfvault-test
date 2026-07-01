"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

import { LandingLanguageSwitcher } from "./landing-language-switcher";

type NavLink = { label: string; href: string };

const PRIMARY_LINKS: NavLink[] = [
  { label: "Compress", href: "#compress" },
  { label: "Edit", href: "#edit" },
  { label: "Convert", href: "#convert" },
  { label: "AI Summarizer", href: "#ai-summarizer" },
];

const ALL_TOOLS_MENU: NavLink[] = [
  { label: "PDF Editor", href: "#edit" },
  { label: "Convert Document", href: "#convert" },
  { label: "Compress PDF", href: "#compress" },
  { label: "Organize Pages", href: "#organize" },
  { label: "Password Protect", href: "#protect" },
];

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
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

/** Generic dropdown shell: opens on click, closes on outside-click and Escape. */
function DropdownShell({
  children,
  items,
  label,
}: {
  children: React.ReactNode;
  items: NavLink[];
  label: string;
}) {
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
        className="flex items-center gap-1 text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {children}
        <ChevronDown
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[200px] rounded-xl border border-[var(--pv-card-border)] bg-white p-1.5 shadow-lg"
          role="menu"
        >
          {items.map((item) => (
            <a
              key={item.label}
              className="block rounded-lg px-3 py-2 text-[14px] text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-section-gray)] focus-visible:bg-[var(--pv-section-gray)] focus-visible:outline-none"
              href={item.href}
              role="menuitem"
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="w-full border-b border-[var(--pv-border-subtle)] bg-[var(--pv-header-bg)]">
      <div className="pv-container flex h-[52px] items-center justify-between gap-4">
        {/* Left: logo + primary nav */}
        <div className="flex items-center gap-7">
          <a className="flex shrink-0 items-center" href="#top">
            <Image
              priority
              alt="PDFVault"
              className="h-[26px] w-auto object-contain"
              height={26}
              src="/landing/logo-with-text.png"
              width={104}
            />
          </a>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 lg:flex"
          >
            <DropdownShell items={ALL_TOOLS_MENU} label="All tools menu">
              All Tools
            </DropdownShell>
            {PRIMARY_LINKS.map((link) => (
              <a
                key={link.label}
                className="text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Right: language + auth */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <LandingLanguageSwitcher />
          </div>

          <a
            className="pv-btn-secondary hidden px-5 py-1.5 text-[14px] sm:inline-flex"
            href={ROUTES.AUTH.SIGN_IN}
          >
            Login
          </a>
          <a
            className="pv-btn-primary inline-flex px-5 py-1.5 text-[14px]"
            href={ROUTES.AUTH.SIGN_UP}
          >
            Get started
          </a>

          {/* Mobile menu toggle */}
          <button
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--pv-text-primary)] lg:hidden"
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
          >
            <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.75"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <nav
          aria-label="Mobile"
          className="border-t border-[var(--pv-border-subtle)] bg-[var(--pv-header-bg)] px-5 py-3 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {[{ label: "All Tools", href: "#tools" }, ...PRIMARY_LINKS].map(
              (link) => (
                <li key={link.label}>
                  <a
                    className="block rounded-lg px-2 py-2.5 text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                </li>
              ),
            )}
            <li className="mt-1 px-2 py-1">
              <LandingLanguageSwitcher variant="mobile" />
            </li>
            <li className="flex flex-col gap-2 px-2 pt-1">
              <a
                className="inline-flex w-full justify-center rounded-full border border-[var(--pv-border-subtle)] bg-white px-5 py-2 text-[14px] font-medium"
                href={ROUTES.AUTH.SIGN_IN}
                onClick={() => setMobileOpen(false)}
              >
                Login
              </a>
              <a
                className="pv-btn-primary inline-flex w-full justify-center px-5 py-2 text-[14px]"
                href={ROUTES.AUTH.SIGN_UP}
                onClick={() => setMobileOpen(false)}
              >
                Get started
              </a>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
