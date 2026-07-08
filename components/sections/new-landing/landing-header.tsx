"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

import { LandingLanguageSwitcher } from "./landing-language-switcher";

type NavLink = { label: string; href: string };

const PRIMARY_LINKS: NavLink[] = [
  { label: "Compress", href: "#compress" },
  { label: "Edit", href: "#edit" },
  { label: "Convert", href: "#convert" },
  { label: "AI Summarizer", href: "#ai-summarizer" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sticky-header state: after ~8px the header condenses (tighter height,
  // white/blurred background, subtle shadow) so it visually detaches from
  // the hero without ever leaving the viewport.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? "border-[var(--pv-border-subtle)] bg-white/85 shadow-[0_4px_18px_-14px_rgba(0,0,0,0.25)]"
          : "border-transparent bg-[var(--pv-header-bg)]"
      }`}
    >
      <div
        className={`pv-container flex items-center justify-between gap-4 transition-[height] duration-300 ${
          scrolled ? "h-[48px]" : "h-[52px]"
        }`}
      >
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
            <a
              className="text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70"
              href={ROUTES.PUBLIC.ALL_TOOLS}
            >
              All Tools
            </a>
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
            href={ROUTES.AUTH.LOGIN}
          >
            Login
          </a>
          <a
            className="pv-btn-primary inline-flex px-5 py-1.5 text-[14px]"
            href={ROUTES.AUTH.SIGNUP}
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
            {[
              { label: "All Tools", href: ROUTES.PUBLIC.ALL_TOOLS },
              ...PRIMARY_LINKS,
            ].map((link) => (
              <li key={link.label}>
                <a
                  className="block rounded-lg px-2 py-2.5 text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="mt-1 px-2 py-1">
              <LandingLanguageSwitcher variant="mobile" />
            </li>
            <li className="flex flex-col gap-2 px-2 pt-1">
              <a
                className="inline-flex w-full justify-center rounded-full border border-[var(--pv-border-subtle)] bg-white px-5 py-2 text-[14px] font-medium"
                href={ROUTES.AUTH.LOGIN}
                onClick={() => setMobileOpen(false)}
              >
                Login
              </a>
              <a
                className="pv-btn-primary inline-flex w-full justify-center px-5 py-2 text-[14px]"
                href={ROUTES.AUTH.SIGNUP}
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
