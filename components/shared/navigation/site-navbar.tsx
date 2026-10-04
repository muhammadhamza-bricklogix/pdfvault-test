"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowDown01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer, Dropdown, Label, Separator } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { stripLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";

import { LanguageSwitcher } from "./language-switcher";

const PDF_TOOL_LINKS = [
  { href: ROUTES.PUBLIC.ALL_TOOLS, label: "All tools overview" },
  { href: ROUTES.TOOLS.PDF_EDITOR, label: "PDF Composer" },
  // Hidden 2026-08-28 — PDF → Excel parked pending future work.
  // Do not remove; re-enable once the pipeline is ready.
  // { href: ROUTES.TOOLS.PDF_TO_EXCEL, label: "PDF to Excel" },
] as const;

const DRAWER_LINKS = [
  ...PDF_TOOL_LINKS,
  { href: ROUTES.LEGAL.CONTACT, label: "Contact" },
  { href: ROUTES.PUBLIC.HOME, label: "Home" },
] as const;

// Route prefixes that render their own bespoke chrome (logo + language) and
// don't want the marketing SiteNavbar stacked on top. Keeping this local so
// SiteFooter can mirror the same list without a shared import cycle.
const HIDE_ON_PATHNAMES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  // /forms/w-9 renders the LandingHeader inside its page so its chrome
  // matches the marketing landing page. Bail out here to prevent
  // SiteNavbar stacking on top.
  "/forms/w-9",
  "/forms/1099-nec",
];

// Editor / tool routes where a signed-out user may have a pending file +
// edits waiting in IndexedDB. Sign-in / Sign-up nav from these routes
// must round-trip through the same URL via `?redirect_url=` so the
// hydrator's post-signin restore path fires on return and the user's
// work isn't lost on the dashboard.
const AUTH_RETURN_ROUTES = [
  "/pdf-composer",
  "/pdf-editor",
  "/w-9-form",
  "/convert/",
] as const;

/**
 * Return path to hand to `dispatchAuthModal({ redirectUrl })` so the
 * finalize `window.location.assign(…)` inside LoginCard/SignupCard
 * lands back on the same route the user opened the modal from.
 * Non-editor routes → undefined so the cards fall back to their
 * default (dashboard). Replaces the previous `withAuthRedirect` helper
 * that appended `?redirect_url=…` to the standalone /sign-in href.
 */
function authReturnUrlFor(pathname: string): string | undefined {
  const returnHere = AUTH_RETURN_ROUTES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  return returnHere ? pathname : undefined;
}

export function SiteNavbar() {
  const router = useRouter();
  // `isLoaded` gates auth-conditional buttons so the server-rendered shell
  // matches the first client render. Both branches are hidden until Clerk has
  // hydrated, preventing the "scripts inside React components" warning that
  // Clerk's `<Show>` component triggers and the auth-state flicker on slow
  // connections.
  const { isLoaded, isSignedIn } = useAuth();
  const showSignedOut = isLoaded && !isSignedIn;
  const showSignedIn = isLoaded && isSignedIn;

  // Mobile drawer is controlled so every action that navigates can
  // explicitly close it before pushing the route. The previous
  // uncontrolled drawer just navigated under the open backdrop, which
  // on mobile left the menu covering the new page (QA report
  // 2026-06-16). `Drawer.CloseTrigger` (the × button) still works via
  // the same `setIsDrawerOpen(false)`.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navigateAndCloseDrawer = (href: string): void => {
    setIsDrawerOpen(false);
    router.push(href);
  };

  // Close the drawer whenever the route changes. The explicit
  // `setIsDrawerOpen(false)` inside `navigateAndCloseDrawer` already
  // covers Button/Link onPress paths, but Sign In / Sign Up Free targets
  // (/sign-in, /sign-up) sit inside the SAME `(marketing)` layout group
  // as the home page, so the navbar — and the drawer's React state —
  // persists across the transition. If the click → state update race
  // loses to Next.js's navigation cycle on iOS Safari (reported by QA
  // 2026-06-17), the drawer can stay visually open over the auth page.
  // A pathname-driven sync close makes the drawer fully predictable:
  // any route change clears it, regardless of which path got us there.
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDrawerOpen(false);
  }, [pathname]);

  // Auth routes render their own logo + language menu — bail out here to
  // avoid the double-header stack the user reported.
  //
  // QA 2026-09-22: on a locale-prefixed URL (`/ar/forms/w-9`),
  // `usePathname()` keeps the `/ar/` prefix, so a raw `.startsWith`
  // against `/forms/w-9` silently failed and SiteNavbar rendered on
  // top of the page's own LandingHeader — a duplicated header visible
  // only on non-EN locales (EN has no prefix, so it happened to work
  // there). `stripLocalePrefix` is the established fix for this exact
  // class of bug elsewhere in the app (EditorTopBar, ShareModal, etc.)
  // — see its own doc comment in locale-map.ts.
  const strippedPathname = stripLocalePrefix(pathname);

  if (HIDE_ON_PATHNAMES.some((prefix) => strippedPathname.startsWith(prefix))) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-default-200/80 bg-[var(--color-background)]/90 backdrop-blur-md dark:border-default-800/80">
      <div className="flex w-full items-center gap-4 px-6 py-3.5 sm:px-8">
        <Drawer isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <Button
            isIconOnly
            aria-label="Open navigation menu"
            className="lg:hidden"
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon icon={Menu01Icon} size={20} />
          </Button>
          <Drawer.Backdrop>
            <Drawer.Content placement="left">
              <Drawer.Dialog>
                <Drawer.CloseTrigger />
                <Drawer.Header>
                  <Drawer.Heading className="flex items-center gap-2">
                    <Image
                      priority
                      alt="PDFVault"
                      className="h-9 w-auto object-contain"
                      height={36}
                      src="/landing/logo-with-text.png"
                      width={144}
                    />
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <nav className="flex flex-col gap-1">
                    {DRAWER_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-default-500 transition-colors hover:bg-default-100 hover:text-foreground"
                        href={item.href}
                        // `<Link>` doesn't trigger our React state — close
                        // the drawer manually on tap. Without this the
                        // drawer overlays the destination page.
                        onClick={() => setIsDrawerOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <Separator className="my-4" />

                  <div className="flex flex-col gap-3 px-3">
                    <ThemeToggle />
                    <LanguageSwitcher />

                    {showSignedOut ? (
                      // Single "Login" CTA now — the modal hosts both
                      // sign-in and sign-up tabs. Removes the previous
                      // "Sign up free" button per the 2026-08-28 unify
                      // change. Users can switch to signup via the link
                      // inside the modal. `redirectUrl` is only set for
                      // editor routes (see `authReturnUrlFor`) so the
                      // cards' `window.location.assign(…)` finalize
                      // lands back in the composer with the pending
                      // file waiting in IDB.
                      <Button
                        className="w-full"
                        variant="ghost"
                        onPress={() => {
                          setIsDrawerOpen(false);
                          dispatchAuthModal({
                            mode: "login",
                            redirectUrl: authReturnUrlFor(pathname ?? ""),
                          });
                        }}
                      >
                        Login
                      </Button>
                    ) : null}

                    {showSignedIn ? (
                      <Button
                        className="w-full"
                        variant="outline"
                        onPress={() =>
                          navigateAndCloseDrawer(ROUTES.APP.DASHBOARD)
                        }
                      >
                        Dashboard
                      </Button>
                    ) : null}
                  </div>
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <Link
          className="flex shrink-0 items-center gap-2.5"
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

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="hidden lg:block">
            <Dropdown>
              <Button
                className="gap-1 font-medium text-default-600 dark:text-default-400"
                variant="ghost"
              >
                All PDF tools
                <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
              </Button>
              <Dropdown.Popover className="min-w-[220px]">
                <Dropdown.Menu aria-label="PDF tools">
                  {PDF_TOOL_LINKS.map((item) => (
                    <Dropdown.Item
                      key={item.href}
                      href={item.href}
                      id={item.href}
                      textValue={item.label}
                    >
                      <Label>{item.label}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>

          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>

          {showSignedOut ? (
            // Single "Login" button. Modal handles both sign-in and
            // sign-up via an in-card tab switch. Removed "Sign up free"
            // in the 2026-08-28 unify per PM. `redirectUrl` only when
            // we're on an editor route so post-signin lands back with
            // the pending file intact (item #15 finalize nav still runs
            // inside LoginCard).
            <Button
              className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-red-600 px-5 font-semibold text-white shadow-sm shadow-red-200 transition-shadow hover:shadow-red-300 dark:shadow-red-900/30"
              onPress={() =>
                dispatchAuthModal({
                  mode: "login",
                  redirectUrl: authReturnUrlFor(pathname ?? ""),
                })
              }
            >
              Login
            </Button>
          ) : null}

          {showSignedIn ? (
            <Button
              className="rounded-lg font-medium"
              variant="outline"
              onPress={() => router.push(ROUTES.APP.DASHBOARD)}
            >
              Dashboard
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
