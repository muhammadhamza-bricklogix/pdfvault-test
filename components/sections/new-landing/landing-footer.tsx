import Image from "next/image";

import { ROUTES } from "@/lib/shared/constants/routes";
import { TOOL_ROUTE } from "@/lib/shared/constants/tool-routes";

type FooterLink = { label: string; href: string };
type FooterColumn = { heading: string; links: FooterLink[] };

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "TOOLS",
    links: [
      // Edit → PDF Composer. Compress → editor with compress dialog auto-open.
      // Convert → the Word-to-PDF landing (most-used input format).
      { label: "Edit & SIgn", href: ROUTES.TOOLS.PDF_EDITOR },
      { label: "Compress", href: TOOL_ROUTE.compress },
      { label: "Convert", href: "/convert/pdf-to-word" },
    ],
  },
  {
    heading: "COMPANY",
    links: [
      // "About Us" hidden until the /about page ships (was a dead #hash link).
      // "Pricing" hidden until the public pricing page ships.
      { label: "Contact Us", href: ROUTES.LEGAL.CONTACT },
    ],
  },
  {
    heading: "LEGAL",
    links: [
      { label: "Privacy Policy", href: ROUTES.LEGAL.PRIVACY },
      { label: "Terms & Conditions", href: ROUTES.LEGAL.TERMS },
      { label: "Refund Policy", href: ROUTES.LEGAL.REFUND },
      { label: "Cookie Policy", href: ROUTES.LEGAL.COOKIES },
      { label: "Do Not Sell", href: ROUTES.LEGAL.DO_NOT_SELL },
    ],
  },
  {
    heading: "ACCOUNT",
    links: [
      // Changelog removed; replaced with the auth pair per PM review.
      { label: "Login", href: ROUTES.AUTH.SIGN_IN },
      { label: "Register", href: ROUTES.AUTH.SIGN_UP },
    ],
  },
];

// Kept for the future — re-render the icon row in the copyright bar once
// real social profile URLs land. Currently unused because dead #hash links
// shipped as anchors were flagged in the production audit.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SOCIAL_LINKS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "PDFVault on LinkedIn",
    href: "#linkedin",
    icon: (
      <path d="M4.98 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.4 9h3.2v10.5H3.4V9Zm5.3 0h3.07v1.43h.04c.43-.78 1.48-1.6 3.05-1.6 3.26 0 3.86 2.0 3.86 4.6v6.07h-3.2v-5.38c0-1.28-.02-2.93-1.8-2.93-1.8 0-2.07 1.39-2.07 2.83v5.48H8.7V9Z" />
    ),
  },
  {
    label: "PDFVault on Facebook",
    href: "#facebook",
    icon: (
      <path d="M13.5 21v-8h2.2l.4-2.7h-2.6V8.55c0-.78.23-1.31 1.37-1.31h1.32V4.84c-.64-.07-1.28-.1-1.92-.1-1.9 0-3.21 1.16-3.21 3.29V10.3H8.5V13h2.25v8h2.75Z" />
    ),
  },
  {
    label: "PDFVault on X",
    href: "#x",
    icon: (
      <path d="M17.3 3.75h2.7l-5.9 6.74 6.94 9.17h-5.43l-4.25-5.56-4.87 5.56H3.78l6.31-7.21L3.43 3.75h5.57l3.84 5.08 4.46-5.08Zm-.95 14.27h1.5L7.7 5.27H6.1l10.25 12.75Z" />
    ),
  },
  {
    label: "PDFVault on Instagram",
    href: "#instagram",
    icon: (
      <path d="M12 4.8c2.34 0 2.62.01 3.54.05.85.04 1.32.18 1.63.3.41.16.7.35 1.01.66.31.31.5.6.66 1.01.12.31.26.78.3 1.63.04.92.05 1.2.05 3.54s-.01 2.62-.05 3.54c-.04.85-.18 1.32-.3 1.63-.16.41-.35.7-.66 1.01-.31.31-.6.5-1.01.66-.31.12-.78.26-1.63.3-.92.04-1.2.05-3.54.05s-2.62-.01-3.54-.05c-.85-.04-1.32-.18-1.63-.3a2.7 2.7 0 0 1-1.01-.66 2.7 2.7 0 0 1-.66-1.01c-.12-.31-.26-.78-.3-1.63C4.81 14.62 4.8 14.34 4.8 12s.01-2.62.05-3.54c.04-.85.18-1.32.3-1.63.16-.41.35-.7.66-1.01.31-.31.6-.5 1.01-.66.31-.12.78-.26 1.63-.3C9.38 4.81 9.66 4.8 12 4.8Zm0 3.7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5.77a2.27 2.27 0 1 1 0-4.54 2.27 2.27 0 0 1 0 4.54Zm4.46-5.91a.82.82 0 1 1-1.64 0 .82.82 0 0 1 1.64 0Z" />
    ),
  },
];

const FOCUS_RING =
  "focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60";

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

/**
 * Footer background — the designer's dark-red vault artwork
 * (`/landing/footer-bg.png`, native 4320×2472, base #400000 with faint baked-in
 * chevron contours). Used directly per the pixel-accurate spec: `cover`,
 * top-centred, and clipped to the footer's height by `overflow-hidden`. No
 * inversion, tint, overlay, or extra gradient — the artwork is deliberately
 * very low contrast.
 */
function FooterBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 select-none bg-cover bg-top bg-no-repeat"
      style={{ backgroundImage: "url('/landing/footer-bg.png')" }}
    />
  );
}

export function LandingFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[#400000] text-white">
      <FooterBackground />

      <div className="relative z-[1] w-full px-6 sm:px-10 md:min-h-[589px]">
        {/* Top: brand + four link columns (measured desktop grid).
            Content is center-aligned per product 2026-07-23 — brand
            block, link columns, and copyright all read centered. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 pt-14 sm:grid-cols-4 md:grid-cols-[440px_132px_145px_152px_155px] md:gap-x-[54px] md:pt-[100px]">
          {/* Brand + contact */}
          <div className="col-span-2 flex flex-col items-center text-center sm:col-span-4 md:col-span-1">
            <Image
              alt="PDFVault"
              className="mx-auto h-[40px] w-auto brightness-0 invert"
              height={40}
              src="/landing/logo-with-text.png"
              width={116}
            />
            <p className="mt-6 max-w-[250px] text-[16px] leading-[1.55] text-white/80">
              A smarter, more secure place for your PDFs.
            </p>
            <div className="mt-8 flex flex-col items-center gap-5">
              <a
                className={`flex items-center gap-3 text-[14px] text-white transition-opacity hover:opacity-80 ${FOCUS_RING}`}
                href="mailto:support@pdfvault.ai"
              >
                <SendIcon />
                support@pdfvault.ai
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className="text-center"
            >
              <h2 className="text-[14px] font-semibold uppercase tracking-[0.04em] text-white">
                {column.heading}
              </h2>
              <ul className="mt-6 flex flex-col items-center gap-[18px]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      className={`inline-block text-[14px] text-white/75 transition-colors duration-200 hover:text-white ${FOCUS_RING}`}
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

        {/*
          Bottom: copyright. Social icons were dead #hash links so they're
          hidden until real account URLs exist — re-enable by mapping over
          SOCIAL_LINKS again once the hrefs are set.
        */}
        <div className="mt-14 border-t border-white/10 px-2 pb-14 pt-8 md:absolute md:left-10 md:right-10 md:top-[438px] md:mt-0 md:px-4 md:pb-0 md:pt-6 lg:px-6">
          <div className="flex flex-row flex-nowrap items-center justify-center gap-3 sm:gap-4">
            <p className="text-center text-[11px] text-white/60 sm:text-[14px]">
              © 2026,{" "}
              <span className="font-semibold text-white/90">PDFVault</span> All
              rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
