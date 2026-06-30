import Image from "next/image";

import { ROUTES } from "@/lib/shared/constants/routes";

type FooterLink = { label: string; href: string };
type FooterColumn = { heading: string; links: FooterLink[] };

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "TOOLS",
    links: [
      { label: "Edit & Sign", href: ROUTES.TOOLS.PDF_EDITOR },
      { label: "Compress", href: ROUTES.TOOLS.BY_SLUG("compress") },
      { label: "Convert", href: ROUTES.TOOLS.BY_SLUG("convert") },
    ],
  },
  {
    heading: "COMPANY",
    links: [
      { label: "Pricing", href: ROUTES.PUBLIC.PRICING },
      { label: "Contact Us", href: ROUTES.LEGAL.CONTACT },
      { label: "About Us", href: "#about" },
    ],
  },
  {
    heading: "HELP",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Privacy", href: ROUTES.LEGAL.PRIVACY },
      { label: "Terms & Condition", href: ROUTES.LEGAL.TERMS },
    ],
  },
  {
    heading: "ACCOUNT",
    links: [
      { label: "Log In", href: ROUTES.AUTH.SIGN_IN },
      { label: "Sign Up", href: ROUTES.AUTH.SIGN_UP },
      { label: "Changelog", href: "#changelog" },
    ],
  },
];

const SOCIAL_LINKS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "LinkedIn",
    href: "#linkedin",
    icon: (
      <path d="M4.98 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.4 9h3.2v10.5H3.4V9Zm5.3 0h3.07v1.43h.04c.43-.78 1.48-1.6 3.05-1.6 3.26 0 3.86 2.0 3.86 4.6v6.07h-3.2v-5.38c0-1.28-.02-2.93-1.8-2.93-1.8 0-2.07 1.39-2.07 2.83v5.48H8.7V9Z" />
    ),
  },
  {
    label: "Facebook",
    href: "#facebook",
    icon: (
      <path d="M13.5 21v-8h2.2l.4-2.7h-2.6V8.55c0-.78.23-1.31 1.37-1.31h1.32V4.84c-.64-.07-1.28-.1-1.92-.1-1.9 0-3.21 1.16-3.21 3.29V10.3H8.5V13h2.25v8h2.75Z" />
    ),
  },
  {
    label: "X",
    href: "#x",
    icon: (
      <path d="M17.3 3.75h2.7l-5.9 6.74 6.94 9.17h-5.43l-4.25-5.56-4.87 5.56H3.78l6.31-7.21L3.43 3.75h5.57l3.84 5.08 4.46-5.08Zm-.95 14.27h1.5L7.7 5.27H6.1l10.25 12.75Z" />
    ),
  },
  {
    label: "Instagram",
    href: "#instagram",
    icon: (
      <path d="M12 4.8c2.34 0 2.62.01 3.54.05.85.04 1.32.18 1.63.3.41.16.7.35 1.01.66.31.31.5.6.66 1.01.12.31.26.78.3 1.63.04.92.05 1.2.05 3.54s-.01 2.62-.05 3.54c-.04.85-.18 1.32-.3 1.63-.16.41-.35.7-.66 1.01-.31.31-.6.5-1.01.66-.31.12-.78.26-1.63.3-.92.04-1.2.05-3.54.05s-2.62-.01-3.54-.05c-.85-.04-1.32-.18-1.63-.3a2.7 2.7 0 0 1-1.01-.66 2.7 2.7 0 0 1-.66-1.01c-.12-.31-.26-.78-.3-1.63C4.81 14.62 4.8 14.34 4.8 12s.01-2.62.05-3.54c.04-.85.18-1.32.3-1.63.16-.41.35-.7.66-1.01.31-.31.6-.5 1.01-.66.31-.12.78-.26 1.63-.3C9.38 4.81 9.66 4.8 12 4.8Zm0 3.7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5.77a2.27 2.27 0 1 1 0-4.54 2.27 2.27 0 0 1 0 4.54Zm4.46-5.91a.82.82 0 1 1-1.64 0 .82.82 0 0 1 1.64 0Z" />
    ),
  },
];

function SendIcon() {
  return (
    <svg aria-hidden fill="none" height="18" viewBox="0 0 20 20" width="18">
      <path
        d="M17.5 2.5 9 11M17.5 2.5l-5.4 15-3.1-6.5L2.5 7.9l15-5.4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden fill="none" height="18" viewBox="0 0 20 20" width="18">
      <path
        d="M6.5 3.5c.4 0 .76.24.9.62l.96 2.4a1 1 0 0 1-.24 1.07l-1.1 1.1a11 11 0 0 0 4.3 4.3l1.1-1.1a1 1 0 0 1 1.06-.24l2.4.96c.38.15.62.5.62.9V16a1.5 1.5 0 0 1-1.6 1.5C8.6 17.1 2.9 11.4 2.5 4.6A1.5 1.5 0 0 1 4 3h2.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/**
 * Footer background motif, extracted directly from the reference art
 * (`/landing/footer-pattern.png`) — soft, rounded chevron bands in a slightly
 * lighter maroon. Baked as a faint white-alpha PNG so it composites over the
 * #400000 footer fill exactly as in the design.
 */
function FooterPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/landing/footer-pattern.png')" }}
    />
  );
}

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-[var(--pv-footer-bg)] text-white">
      <FooterPattern />
      <div className="pv-container relative z-10 py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 md:grid-cols-[1.8fr_1fr_1fr_1fr_1fr] md:gap-x-10">
          {/* Brand block */}
          <div className="col-span-2 sm:col-span-4 md:col-span-1">
            <Image
              alt="PDFVault"
              className="h-8 w-auto brightness-0 invert"
              height={70}
              src="/landing/logo-with-text.png"
              width={202}
            />
            <p className="mt-5 max-w-[260px] text-[15px] leading-relaxed text-white/70">
              A smarter, more secure place for your PDFs.
            </p>
            <div className="mt-8 flex flex-col gap-4">
              <a
                className="flex items-center gap-3 text-[14px] text-white/80 transition-colors hover:text-white"
                href="mailto:info@pdfvault.com"
              >
                <SendIcon />
                Info@pdfvault.com
              </a>
              <a
                className="flex items-center gap-3 text-[14px] text-white/80 transition-colors hover:text-white"
                href="tel:+88123456789"
              >
                <PhoneIcon />
                +88 123 456 789
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white">
                {column.heading}
              </h2>
              <ul className="mt-5 flex flex-col gap-3.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      className="text-[14px] text-white/65 transition-colors hover:text-white"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-white/60">
            © 2026,{" "}
            <span className="font-semibold text-white/85">Pdfvault</span> All
            rights reserved.
          </p>
          <ul className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.label}>
                <a
                  aria-label={social.label}
                  className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  href={social.href}
                >
                  <svg
                    aria-hidden
                    fill="currentColor"
                    height="20"
                    viewBox="0 0 24 24"
                    width="20"
                  >
                    {social.icon}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
