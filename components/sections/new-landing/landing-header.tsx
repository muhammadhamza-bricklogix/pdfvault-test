"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { Modal } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { FormsModal } from "@/components/shared/forms-modal";
import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { useIsEntitled } from "@/lib/client/hooks/billing/use-is-entitled";
import { usersService } from "@/lib/shared/api/services/users.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { TOOL_ROUTE } from "@/lib/shared/constants/tool-routes";

import { AllToolsCatalog } from "./all-tools-catalog";
import { LandingLanguageSwitcher } from "./landing-language-switcher";

type NavLink = { label: string; href: string };

// Primary nav tools — real routes, not `#hash` anchors. Order per PM
// review 2026-07: Edit → Convert → Compress. AI Summarizer hidden until
// the AI feature ships. Edit / Compress route straight into the PDF
// composer with the matching tool preselected — one upload screen for
// every composer entry (QA 2026-08-27). Convert still owns its own
// per-slug marketing page since that flow explains the target format.
const PRIMARY_LINKS: NavLink[] = [
  { label: "Edit", href: TOOL_ROUTE.edit },
  { label: "Convert", href: "/convert/pdf-to-word" },
  { label: "Compress", href: TOOL_ROUTE.compress },
  // { label: "AI Summarizer", href: "/ai-summarizer" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [formsModalOpen, setFormsModalOpen] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const entitled = useIsEntitled();

  const handleLogOut = () => {
    void usersService.signOutAudit().catch(() => undefined);
    void signOut();
  };

  // Auto-dismiss the All Tools + mobile drawer whenever the route
  // changes. Tiles inside the modal used to leave the modal open behind
  // the destination page ("nothing happened" QA report); syncing to
  // pathname avoids the need to thread a callback through the
  // server-safe AllToolsCatalog. Same-pathname tile navigation
  // (`?tool=edit` → `?tool=compress` on `/pdf-composer`) is handled
  // separately by the click delegator on the Modal.Body below —
  // adding `useSearchParams()` here forces a Suspense boundary that
  // breaks static prerender on `/convert/[slug]`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToolsModalOpen(false);

    setFormsModalOpen(false);
    setMobileOpen(false);
  }, [pathname]);
  // Signed-in state resolved via Clerk. Until `isLoaded` we render
  // nothing on the auth slot so the header doesn't flash Login → then
  // → Dashboard on hydration.
  const showAuthButtons = isLoaded;

  // Sticky-header state: after ~8px the header condenses (tighter height,
  // white/blurred background, subtle shadow) so it visually detaches from
  // the hero without ever leaving the viewport.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openToolsModal = () => {
    setToolsModalOpen(true);
    setMobileOpen(false);
  };

  const openFormsModal = () => {
    setFormsModalOpen(true);
    setMobileOpen(false);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full border-b backdrop-blur transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
          scrolled
            ? "border-[var(--pv-border-subtle)] bg-white/85 shadow-[0_4px_18px_-14px_rgba(0,0,0,0.25)]"
            : "border-transparent bg-[var(--pv-header-bg)]"
        }`}
      >
        <div
          className={`pv-container flex items-center justify-between gap-4 transition-[height] duration-300 ${
            scrolled ? "h-[62px]" : "h-[68px]"
          }`}
        >
          {/* Left: logo + primary nav */}
          <div className="flex items-center gap-7">
            <Link
              aria-label="PDFVault home"
              className="flex shrink-0 items-center"
              href={ROUTES.PUBLIC.HOME}
            >
              <Image
                priority
                alt="PDFVault"
                className="h-[40px] w-auto object-contain sm:h-[46px]"
                height={46}
                src="/landing/logo-with-text.png"
                width={184}
              />
            </Link>

            <nav
              aria-label="Primary"
              className="hidden items-center gap-6 lg:flex"
            >
              <button
                aria-expanded={toolsModalOpen}
                aria-haspopup="dialog"
                className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--pv-brand-primary)] px-4 py-1.5 text-[14px] font-medium transition-colors ${
                  toolsModalOpen
                    ? "bg-[var(--pv-brand-primary)] text-white shadow-sm"
                    : "bg-transparent text-[var(--pv-brand-primary)] hover:bg-[var(--pv-brand-primary)]/10"
                }`}
                type="button"
                onClick={openToolsModal}
              >
                <svg
                  aria-hidden
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <path
                    d="M2 3.5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 7 3.5v2A1.5 1.5 0 0 1 5.5 7h-2A1.5 1.5 0 0 1 2 5.5v-2Zm7 0A1.5 1.5 0 0 1 10.5 2h2A1.5 1.5 0 0 1 14 3.5v2A1.5 1.5 0 0 1 12.5 7h-2A1.5 1.5 0 0 1 9 5.5v-2Zm-7 7A1.5 1.5 0 0 1 3.5 9h2A1.5 1.5 0 0 1 7 10.5v2A1.5 1.5 0 0 1 5.5 14h-2A1.5 1.5 0 0 1 2 12.5v-2Zm7 0A1.5 1.5 0 0 1 10.5 9h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 9 12.5v-2Z"
                    fill="currentColor"
                  />
                </svg>
                All Tools
                <svg
                  aria-hidden
                  className={`transition-transform duration-200 ${toolsModalOpen ? "rotate-180" : ""}`}
                  fill="none"
                  height="12"
                  viewBox="0 0 12 12"
                  width="12"
                >
                  <path
                    d="M3 4.5 6 7.5l3-3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
              {PRIMARY_LINKS.map((link) => (
                <Link
                  key={link.label}
                  className="text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70"
                  href={link.href}
                >
                  {link.label}
                </Link>
              ))}
              <button
                aria-expanded={formsModalOpen}
                aria-haspopup="dialog"
                className="text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70"
                type="button"
                onClick={openFormsModal}
              >
                Forms
              </button>
            </nav>
          </div>

          {/* Right: theme + language + auth */}
          <div className="flex items-center gap-3">
            <div className="pv-theme-chip hidden lg:block">
              <ThemeToggle size="sm" variant="ghost" />
            </div>
            <div className="hidden lg:block">
              <LandingLanguageSwitcher />
            </div>

            {showAuthButtons ? (
              isSignedIn ? (
                <>
                  <Link
                    className="pv-btn-primary inline-flex px-5 py-1.5 text-[14px]"
                    href={ROUTES.APP.DASHBOARD}
                  >
                    Dashboard
                  </Link>
                  <button
                    className="pv-btn-secondary hidden px-5 py-1.5 text-[14px] sm:inline-flex"
                    type="button"
                    onClick={handleLogOut}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    className="pv-btn-secondary hidden px-5 py-1.5 text-[14px] sm:inline-flex"
                    href={ROUTES.AUTH.SIGN_IN}
                  >
                    Login
                  </Link>
                  <Link
                    // Desktop-only. On mobile the hamburger drawer owns the
                    // "Get started" CTA, so we hide it in the top bar to
                    // eliminate the duplicate QA flagged (2026-08-19).
                    className="pv-btn-primary hidden px-5 py-1.5 text-[14px] lg:inline-flex"
                    href={ROUTES.AUTH.SIGN_UP}
                  >
                    Get started
                  </Link>
                </>
              )
            ) : null}

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
              <li>
                <button
                  // Highlighted primary action: brand-tinted background,
                  // grid icon, and a chevron so mobile users can spot the
                  // "everything the app can do" entry point at a glance.
                  // QA 2026-08-19 (low visibility).
                  aria-expanded={toolsModalOpen}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-2 rounded-full border border-[var(--pv-brand-primary)] bg-transparent px-4 py-2.5 text-left text-[15px] font-semibold text-[var(--pv-brand-primary)] transition-colors hover:bg-[var(--pv-brand-primary)]/10"
                  type="button"
                  onClick={openToolsModal}
                >
                  <svg
                    aria-hidden
                    fill="none"
                    height="14"
                    viewBox="0 0 16 16"
                    width="14"
                  >
                    <path
                      d="M2 3.5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 7 3.5v2A1.5 1.5 0 0 1 5.5 7h-2A1.5 1.5 0 0 1 2 5.5v-2Zm7 0A1.5 1.5 0 0 1 10.5 2h2A1.5 1.5 0 0 1 14 3.5v2A1.5 1.5 0 0 1 12.5 7h-2A1.5 1.5 0 0 1 9 5.5v-2Zm-7 7A1.5 1.5 0 0 1 3.5 9h2A1.5 1.5 0 0 1 7 10.5v2A1.5 1.5 0 0 1 5.5 14h-2A1.5 1.5 0 0 1 2 12.5v-2Zm7 0A1.5 1.5 0 0 1 10.5 9h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 9 12.5v-2Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="flex-1">All Tools</span>
                  <svg
                    aria-hidden
                    fill="none"
                    height="14"
                    viewBox="0 0 12 12"
                    width="14"
                  >
                    <path
                      d="m4.5 3 3 3-3 3"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                </button>
              </li>
              {PRIMARY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    className="block rounded-lg px-2 py-2.5 text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  className="block w-full rounded-lg px-2 py-2.5 text-left text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
                  type="button"
                  onClick={openFormsModal}
                >
                  Forms
                </button>
              </li>
              <li className="mt-1 flex items-center gap-3 px-2 py-1">
                <LandingLanguageSwitcher variant="mobile" />
                <div className="pv-theme-chip">
                  <ThemeToggle size="sm" variant="ghost" />
                </div>
              </li>
              <li className="flex flex-col gap-2 px-2 pt-1">
                {showAuthButtons ? (
                  isSignedIn ? (
                    <>
                      <Link
                        className="pv-btn-primary inline-flex w-full justify-center px-5 py-2 text-[14px]"
                        href={ROUTES.APP.DASHBOARD}
                        onClick={() => setMobileOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <button
                        className="inline-flex w-full justify-center rounded-full border border-[var(--pv-border-subtle)] bg-white px-5 py-2 text-[14px] font-medium"
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          handleLogOut();
                        }}
                      >
                        Log out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        className="inline-flex w-full justify-center rounded-full border border-[var(--pv-border-subtle)] bg-white px-5 py-2 text-[14px] font-medium"
                        href={ROUTES.AUTH.SIGN_IN}
                        onClick={() => setMobileOpen(false)}
                      >
                        Login
                      </Link>
                      <Link
                        className="pv-btn-primary inline-flex w-full justify-center px-5 py-2 text-[14px]"
                        href={ROUTES.AUTH.SIGN_UP}
                        onClick={() => setMobileOpen(false)}
                      >
                        Get started
                      </Link>
                    </>
                  )
                ) : null}
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      {/* All Tools modal — full-catalog view without leaving the current page. */}
      <Modal.Backdrop
        isOpen={toolsModalOpen}
        onOpenChange={(o) => setToolsModalOpen(o)}
      >
        <Modal.Container className="items-center justify-center p-4">
          <Modal.Dialog className="w-full max-w-[1180px] rounded-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>All Tools</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="max-h-[80vh] overflow-y-auto p-0">
              {/* Click delegation: any tile navigation dismisses the modal
                  synchronously, regardless of whether the destination is a
                  new pathname (`/pdf-composer` → `/dashboard`) or a same-
                  path query change (`?tool=edit` → `?tool=compress`). The
                  pathname/searchParams useEffect above misses same-path
                  query nav in Next 16 in some flows, so this is the
                  authoritative dismiss. Keeping `AllToolsCatalog` prop-free
                  is required by CLAUDE.md item 20 (RSC serialization). */}
              {/* Delegation catches native click events bubbled up from
                  each Link — including the click Enter/Space fires on a
                  focused <a> — so keyboard users get the same dismiss
                  as mouse users without a separate onKeyDown here. */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
              <div
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a")) {
                    setToolsModalOpen(false);
                  }
                }}
              >
                <AllToolsCatalog />
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <FormsModal isOpen={formsModalOpen} onOpenChange={setFormsModalOpen} />
    </>
  );
}
