"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { Modal } from "@heroui/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
// the AI feature ships.
const PRIMARY_LINKS: NavLink[] = [
  { label: "Edit", href: ROUTES.TOOLS.PDF_EDITOR },
  { label: "Convert", href: "/convert/pdf-to-word" },
  { label: "Compress", href: TOOL_ROUTE.compress },
  // { label: "AI Summarizer", href: "/ai-summarizer" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
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
  // server-safe AllToolsCatalog.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToolsModalOpen(false);

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
            <a
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
            </a>

            <nav
              aria-label="Primary"
              className="hidden items-center gap-6 lg:flex"
            >
              <button
                aria-expanded={toolsModalOpen}
                aria-haspopup="dialog"
                className="pv-btn-secondary inline-flex items-center gap-1.5 px-4 py-1.5 text-[14px]"
                type="button"
                onClick={openToolsModal}
              >
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
                  <a
                    className="pv-btn-primary inline-flex px-5 py-1.5 text-[14px]"
                    href={ROUTES.APP.DASHBOARD}
                  >
                    Dashboard
                  </a>
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
                  <a
                    className="pv-btn-secondary hidden px-5 py-1.5 text-[14px] sm:inline-flex"
                    href={ROUTES.AUTH.SIGN_IN}
                  >
                    Login
                  </a>
                  <a
                    // Top-bar CTA hides while the mobile drawer is open —
                    // the drawer renders its own "Get started" and the pair
                    // felt duplicated. Desktop (lg+) always shows it.
                    className={`pv-btn-primary px-5 py-1.5 text-[14px] ${
                      mobileOpen ? "hidden lg:inline-flex" : "inline-flex"
                    }`}
                    href={ROUTES.AUTH.SIGN_UP}
                  >
                    Get started
                  </a>
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
                  className="block w-full rounded-lg px-2 py-2.5 text-left text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
                  type="button"
                  onClick={openToolsModal}
                >
                  All Tools
                </button>
              </li>
              {PRIMARY_LINKS.map((link) => (
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
                      <a
                        className="pv-btn-primary inline-flex w-full justify-center px-5 py-2 text-[14px]"
                        href={ROUTES.APP.DASHBOARD}
                        onClick={() => setMobileOpen(false)}
                      >
                        Dashboard
                      </a>
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
              <AllToolsCatalog />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
