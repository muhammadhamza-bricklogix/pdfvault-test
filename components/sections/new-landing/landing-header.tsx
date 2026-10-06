"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { Modal } from "@heroui/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { useIsEntitled } from "@/lib/client/hooks/billing/use-is-entitled";
import { usersService } from "@/lib/shared/api/services/users.service";
import { parseLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { clearAllDs11Drafts } from "@/components/sections/forms/Ds11AutoPersist";
import { clearAllDs82Drafts } from "@/components/sections/forms/Ds82AutoPersist";
import { clearAllNecDrafts } from "@/components/sections/forms/NecAutoPersist";

import { LandingLanguageSwitcher } from "./landing-language-switcher";

// Lazy-loaded: AllToolsCatalog renders only when the user clicks
// "All PDF Tools" (opens the modal). FormsModal renders only when
// the user clicks "Forms". Keeping them out of the landing bundle
// saves the hydration cost for the ~95% of visitors who never open
// either. First open shows a brief blank while the chunk loads
// (typically <100ms cached; ~200ms cold).
const AllToolsCatalog = dynamic(
  () => import("./all-tools-catalog").then((m) => m.AllToolsCatalog),
  { ssr: false, loading: () => null },
);
const FormsModal = dynamic(
  () => import("@/components/shared/forms-modal").then((m) => m.FormsModal),
  { ssr: false, loading: () => null },
);

type NavLink = { label: string; href: string };

// Editor / tool routes where a signed-out user may have a pending file
// waiting in the upload workspace or IndexedDB. When the modal opens
// from one of these routes we hand `redirectUrl=<current path>` down
// to LoginCard/SignupCard so the finalize `window.location.assign(…)`
// (item #15) lands back with the pending work intact. Non-editor
// routes (/, /all-tools) omit `redirectUrl` — the cards fall back to
// the dashboard default.
const AUTH_RETURN_ROUTES = [
  "/pdf-composer",
  "/pdf-editor",
  "/w-9-form",
  "/forms/w-9",
  "/forms/1099-nec/edit",
  "/forms/ds-11/edit",
  "/convert/",
] as const;

function authReturnUrlFor(pathname: string): string | undefined {
  // Match AUTH_RETURN_ROUTES against the locale-stripped path so
  // `/de/pdf-composer`, `/es/convert/word-to-pdf`, etc. are treated
  // the same as their unprefixed equivalents. Without this the user
  // signs in on `/de/convert/…` with no returnUrl set, LoginCard
  // falls back to `/dashboard` (English), and the whole app flips
  // out of German after the finalize `window.location.assign(…)`.
  const parsed = parseLocalePrefix(pathname);
  const effectivePath = parsed?.rest ?? pathname;
  const returnHere = AUTH_RETURN_ROUTES.some((prefix) =>
    effectivePath.startsWith(prefix),
  );

  // Return the ORIGINAL locale-prefixed pathname so the finalize
  // navigation lands on the same localized page the user started on.
  return returnHere ? pathname : undefined;
}

// Primary nav tools — real routes, not `#hash` anchors. Order per PM
// review 2026-07: Edit → Convert → Compress. AI Summarizer hidden until
// the AI feature ships. Edit / Compress land on the shared marketing
// hero (`/edit`, `/compress`) that mirrors `/convert/[slug]` — same
// "Drag & drop file to edit" screen for every uploader.
//
// Convert label is localised via next-intl (`nav.convert`) — Weglot
// was mistranslating "Convert" as "Umrechnen" (currency/units) on
// German visitors. See QA F-11.
const PRIMARY_LINK_HREFS = [
  { key: "edit", href: "/edit" },
  { key: "convert", href: "/convert/file-to-pdf" },
  { key: "compress", href: "/compress" },
  // { key: "aiSummarizer", href: "/ai-summarizer" },
] as const;

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [formsModalOpen, setFormsModalOpen] = useState(false);
  // iOS Safari hides native scrollbars at rest. This state backs a
  // custom, always-visible scroll indicator for the All Tools modal.
  const toolsBodyRef = useRef<HTMLDivElement>(null);
  const [toolsHasOverflow, setToolsHasOverflow] = useState(false);
  const [toolsScrollIndicator, setToolsScrollIndicator] = useState({
    height: 0,
    top: 0,
  });
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const entitled = useIsEntitled();
  const tNav = useTranslations("nav");

  // Compose the primary nav from the localised label registry so
  // Convert renders as "Umwandeln" on /de/ instead of Weglot's
  // "Umrechnen" (currency-conversion sense). Memo keeps referential
  // equality across re-renders — the array is passed to two .map()
  // sites and one useEffect dependency further down.
  const primaryLinks = useMemo<NavLink[]>(
    () =>
      PRIMARY_LINK_HREFS.map(({ key, href }) => ({
        label: tNav(key),
        href,
      })),
    [tNav],
  );

  // Prepend the current locale segment to nav hrefs so soft-nav from a
  // localized page (e.g. `/de/`) keeps the visitor in the same locale.
  // Without this, clicking "Convert" / "Edit" / "Compress" from `/de/`
  // lands on `/convert/file-to-pdf` (English) — QA F-15 (2026-09-26).
  // Mirrors `withLocalePrefix` in `upload-workspace.tsx` (commit 774aca5).
  const withLocalePrefix = (path: string) => {
    const parsed = parseLocalePrefix(pathname ?? "/");

    if (!parsed) return path;
    const suffix = path.startsWith("/") ? path : `/${path}`;

    return `/${parsed.locale}${suffix}`;
  };

  const handleLogOut = () => {
    void usersService.signOutAudit().catch(() => undefined);
    clearAllNecDrafts();
    clearAllDs11Drafts();
    clearAllDs82Drafts();
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

  // Measures overflow and keeps the custom scroll thumb synced. The
  // catalog is lazy-loaded, so observing the content wrapper matters:
  // its height changes after the modal first opens.
  useEffect(() => {
    if (!toolsModalOpen) return;
    const scrollContainer = toolsBodyRef.current;

    if (!scrollContainer) return;

    let frame = 0;

    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll =
          scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const hasOverflow = maxScroll > 1;

        setToolsHasOverflow(hasOverflow);

        if (!hasOverflow) {
          setToolsScrollIndicator({ height: 0, top: 0 });

          return;
        }

        const trackHeight = Math.max(scrollContainer.clientHeight - 32, 32);
        const thumbHeight = Math.max(
          32,
          (scrollContainer.clientHeight / scrollContainer.scrollHeight) *
            trackHeight,
        );
        const thumbTop =
          (scrollContainer.scrollTop / maxScroll) * (trackHeight - thumbHeight);

        setToolsScrollIndicator({ height: thumbHeight, top: thumbTop });
      });
    };

    check();

    const observer = new ResizeObserver(check);
    const contentWrapper = scrollContainer.firstElementChild;

    observer.observe(scrollContainer);

    if (contentWrapper) observer.observe(contentWrapper);

    scrollContainer.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scrollContainer.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [toolsModalOpen]);

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
              // Closes the mobile drawer explicitly: navigating to the same
              // route doesn't change `pathname`, so the auto-close effect
              // above wouldn't otherwise fire.
              onClick={() => setMobileOpen(false)}
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
              {primaryLinks.map((link) => (
                <Link
                  key={link.label}
                  className="notranslate wg-notranslate text-[14px] font-medium text-[var(--pv-text-primary)] transition-opacity hover:opacity-70"
                  href={withLocalePrefix(link.href)}
                  translate="no"
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
                    {tNav("dashboard")}
                  </Link>
                  <button
                    className="pv-btn-secondary hidden px-5 py-1.5 text-[14px] sm:inline-flex"
                    type="button"
                    onClick={handleLogOut}
                  >
                    {tNav("logOut")}
                  </button>
                </>
              ) : (
                // Single "Login" CTA — modal hosts both sign-in and
                // sign-up (in-card tab switch). Removed the second
                // "Get started" button per the 2026-08-28 unify (PM).
                // `redirectUrl` only when this route has pending file /
                // upload work; the modal's cards still do the item #15
                // finalize `window.location.assign(…)` on success.
                <button
                  className="pv-btn-primary hidden px-5 py-1.5 text-[14px] sm:inline-flex"
                  type="button"
                  onClick={() =>
                    dispatchAuthModal({
                      mode: "login",
                      redirectUrl: authReturnUrlFor(pathname ?? ""),
                    })
                  }
                >
                  {tNav("login")}
                </button>
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
              {primaryLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    className="notranslate wg-notranslate block rounded-lg px-2 py-2.5 text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
                    href={withLocalePrefix(link.href)}
                    translate="no"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  // `text-start` (logical) rather than `text-left` so this
                  // matches the sibling links in RTL too — `<button>`
                  // defaults to centered text, unlike `<a>`.
                  className="block w-full rounded-lg px-2 py-2.5 text-start text-[15px] font-medium text-[var(--pv-text-primary)] hover:bg-white/60"
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
                        {tNav("dashboard")}
                      </Link>
                      <button
                        className="inline-flex w-full justify-center rounded-full border border-[var(--pv-border-subtle)] bg-white px-5 py-2 text-[14px] font-medium"
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          handleLogOut();
                        }}
                      >
                        {tNav("logOut")}
                      </button>
                    </>
                  ) : (
                    // Mobile drawer variant of the single Login CTA
                    // (see desktop branch above). Close the drawer
                    // BEFORE dispatching so the modal renders over the
                    // regular page chrome, not over the drawer scrim.
                    <button
                      className="pv-btn-primary inline-flex w-full justify-center px-5 py-2 text-[14px]"
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        dispatchAuthModal({
                          mode: "login",
                          redirectUrl: authReturnUrlFor(pathname ?? ""),
                        });
                      }}
                    >
                      Login
                    </button>
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
            <div className="relative">
              <Modal.Body
                ref={toolsBodyRef}
                className="max-h-[80dvh] overflow-y-auto overscroll-contain p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
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
              {toolsHasOverflow ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-4 right-2 top-4 z-10 w-1.5 rounded-full bg-[#ececec] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                  data-testid="all-tools-scroll-indicator"
                >
                  <div
                    className="absolute left-0 right-0 rounded-full bg-[#a8a8a8]"
                    style={{
                      height: `${toolsScrollIndicator.height}px`,
                      transform: `translateY(${toolsScrollIndicator.top}px)`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <FormsModal isOpen={formsModalOpen} onOpenChange={setFormsModalOpen} />
    </>
  );
}
