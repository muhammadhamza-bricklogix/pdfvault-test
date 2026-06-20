"use client";

import type { ReactNode } from "react";

import {
  Cancel01Icon,
  Configuration01Icon,
  File01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { ROUTES } from "@/lib/shared/constants/routes";

import { IdentityPopover } from "./identity-popover";

type DashboardShellProps = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  icon: typeof File01Icon;
  isActive: (pathname: string) => boolean;
  label: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: ROUTES.APP.DASHBOARD,
    icon: File01Icon,
    isActive: (p) => p === ROUTES.APP.DASHBOARD,
    label: "My PDFs",
  },
  {
    href: `${ROUTES.PUBLIC.HOME}#pdf-tools`,
    icon: Configuration01Icon,
    isActive: (p) => p.startsWith("/tools"),
    label: "Tools",
  },
];

type SidebarBodyProps = {
  pathname: string;
  /**
   * Collapsed = icons only, no inline labels. Used for the mobile drawer
   * so the rail stays a tight 64-px column instead of stacking "My files"
   * / "Tools" text under each glyph. Desktop stays expanded.
   */
  collapsed?: boolean;
  onNavigate?: () => void;
};

/**
 * The sidebar's visible content. Shared between the persistent desktop
 * rail and the mobile slide-in drawer so they can never drift apart.
 */
function SidebarBody({
  pathname,
  collapsed = false,
  onNavigate,
}: SidebarBodyProps) {
  return (
    <>
      <div className="flex w-full flex-col items-center gap-6">
        <Link
          aria-label="Go to home"
          className="flex size-9 items-center justify-center rounded-lg text-[var(--color-accent)] transition-colors hover:bg-default-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href={ROUTES.PUBLIC.HOME}
          onClick={onNavigate}
        >
          <Image
            priority
            alt="PDFedits.io"
            className="size-7 object-contain"
            height={28}
            src="/logo.svg"
            width={28}
          />
        </Link>

        <nav
          aria-label="Primary"
          className="flex w-full flex-col items-center gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(pathname);

            return (
              <Tooltip key={item.label} delay={300}>
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={`flex w-full flex-col items-center ${collapsed ? "px-1 py-1.5" : "gap-1 px-1 py-2 text-[10px] font-medium"} transition-colors ${
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-default-500 hover:text-[var(--color-foreground)]"
                  }`}
                  href={item.href}
                  onClick={onNavigate}
                >
                  <span
                    className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                      active
                        ? "bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)]"
                        : "group-hover:bg-default-100"
                    }`}
                  >
                    <HugeiconsIcon icon={item.icon} size={18} />
                  </span>
                  {!collapsed && (
                    <span className="leading-tight">{item.label}</span>
                  )}
                </Link>
                <Tooltip.Content>
                  <p>{item.label}</p>
                </Tooltip.Content>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      <div className="absolute inset-x-0 bottom-4 flex w-full justify-center">
        <IdentityPopover collapsed />
      </div>
    </>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname() ?? "";
  const isMobile = useIsMobile();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Auto-close the drawer when the user navigates so they aren't left
  // staring at an opaque overlay after tapping a nav item. Pathname is
  // an external signal — closing the drawer in response is the
  // textbook valid use of an effect setState (the lint rule is over-broad
  // here).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open — otherwise tapping
  // through the overlay reaches the page underneath on iOS Safari.
  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

  // Render either the persistent rail (desktop) OR the drawer-pattern
  // (mobile) — never both. Earlier the two were CSS-toggled via
  // `hidden lg:flex` / `lg:hidden` but a stale Turbopack bundle was
  // leaking the desktop aside through at narrow viewports. Conditional
  // rendering on `useIsMobile()` is unambiguous: only one shell is
  // mounted at any time.
  if (!isMobile) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-default-50/40">
        <aside className="relative flex h-full w-20 shrink-0 flex-col items-center border-r border-default-200 bg-[var(--color-background)] py-4">
          <SidebarBody pathname={pathname} />
        </aside>
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-default-50/40">
      {/* Mobile slide-in drawer + backdrop. Rendered always (so the open
          transition is smooth) but the drawer is translated off-screen
          when closed. */}
      <button
        aria-hidden={!isMobileOpen}
        aria-label="Close navigation"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        tabIndex={isMobileOpen ? 0 : -1}
        type="button"
        onClick={() => setIsMobileOpen(false)}
      />
      <aside
        aria-hidden={!isMobileOpen}
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[20vw] flex-col items-center border-r border-default-200 bg-[var(--color-background)] py-4 shadow-xl transition-transform duration-200 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Button
          isIconOnly
          aria-label="Close navigation"
          className="absolute right-2 top-2 !rounded-full"
          size="sm"
          variant="ghost"
          onPress={() => setIsMobileOpen(false)}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} />
        </Button>
        <SidebarBody
          pathname={pathname}
          onNavigate={() => setIsMobileOpen(false)}
        />
      </aside>

      {/* Mobile top bar — hamburger + brand. */}
      <div className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-default-200 bg-[var(--color-background)] px-3">
        <Button
          isIconOnly
          aria-controls="dashboard-mobile-sidebar"
          aria-expanded={isMobileOpen}
          aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
          size="sm"
          variant="ghost"
          onPress={() => setIsMobileOpen((open) => !open)}
        >
          <HugeiconsIcon
            icon={isMobileOpen ? Cancel01Icon : Menu01Icon}
            size={20}
          />
        </Button>
        <Link
          aria-label="Go to home"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
          href={ROUTES.PUBLIC.HOME}
        >
          <Image
            priority
            alt="PDFedits.io logo"
            className="size-6 object-contain"
            height={24}
            src="/logo.svg"
            width={24}
          />
          <span>
            <span className="text-[var(--color-accent)]">PDF</span>
            <span className="text-[var(--color-foreground)]">edits</span>
          </span>
        </Link>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
