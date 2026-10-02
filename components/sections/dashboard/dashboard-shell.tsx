/* eslint-disable no-console */
"use client";

import type { ReactNode } from "react";

import {
  ArrowRight01Icon,
  BankIcon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  File01Icon,
  Home01Icon,
  Logout03Icon,
  Menu01Icon,
  MenuSquareIcon,
  SquareUnlock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useClerk, useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { TourHelpButton } from "@/components/shared/product-tour/tour-help-button";
import { useIsEntitled } from "@/lib/client/hooks/billing/use-is-entitled";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { DASHBOARD_MOBILE_SIDEBAR_EVENT } from "@/lib/client/tour/tour-config";
import { usersService } from "@/lib/shared/api/services/users.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { LanguageSwitcher } from "@/components/shared/navigation/language-switcher";
import { clearAllNecDrafts } from "@/components/sections/forms/NecAutoPersist";

import { IdentityPopover } from "./identity-popover";

type DashboardShellProps = {
  children: ReactNode;
};

type IconGlyph = typeof BankIcon;

type NavItem = {
  href: string;
  icon: IconGlyph;
  isActive: (pathname: string) => boolean;
  label: string;
};

const DASHBOARD_TOOLS_PATH = "/dashboard/tools";
const DASHBOARD_FORMS_PATH = "/dashboard/forms";

const NAV_ITEMS: readonly NavItem[] = [
  {
    // Route back to the marketing / landing site. Users kept getting
    // stuck inside the dashboard with no visible way back to the
    // public home — the brand logo above only navigates in-app.
    href: ROUTES.PUBLIC.HOME,
    icon: Home01Icon,
    isActive: () => false,
    label: "Home",
  },
  {
    href: ROUTES.APP.DASHBOARD,
    icon: BankIcon,
    isActive: (p) => p === ROUTES.APP.DASHBOARD,
    label: "My PDFs",
  },
  {
    href: DASHBOARD_TOOLS_PATH,
    icon: MenuSquareIcon,
    isActive: (p) => p.startsWith(DASHBOARD_TOOLS_PATH),
    label: "Tools",
  },
  {
    href: DASHBOARD_FORMS_PATH,
    icon: File01Icon,
    isActive: (p) => p.startsWith(DASHBOARD_FORMS_PATH),
    label: "Forms",
  },
];

/**
 * Brand PNG stacked-layers mark + "PDFVault" wordmark. Uses the same
 * public asset the browser favicon points at so the tab icon + sidebar
 * always match.
 */
function PdfVaultLogo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        aria-hidden
        priority
        alt=""
        className="h-6 w-auto object-contain"
        height={24}
        src="/PDFVault_stacked_layers.png"
        width={24}
      />
      <span className="pv-heading text-[17px] font-semibold leading-none">
        <span className="text-[var(--pv-brand-red-logo)]">PDF</span>
        {/* CSS content so Weglot can't translate the brand ("Vault" -> "Tresor"). */}
        <span className="text-[var(--pv-text-muted)] after:content-['Vault']" />
      </span>
    </div>
  );
}

function SidebarNavItem({
  href,
  icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: IconGlyph;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] ${
        active
          ? "bg-[var(--pv-nav-active)] text-[var(--pv-text-strong)]"
          : "text-[var(--pv-text-body)] hover:bg-[var(--pv-nav-active)]/60 hover:text-[var(--pv-text-strong)]"
      }`}
      href={href}
      onClick={onNavigate}
    >
      <HugeiconsIcon
        className="shrink-0"
        icon={icon}
        size={18}
        strokeWidth={active ? 2 : 1.5}
      />
      <span>{label}</span>
    </Link>
  );
}

/**
 * Pinned profile row — avatar with green online dot, name + verified badge,
 * email, chevron. The whole row is the popover trigger.
 */
function ProfileRow({
  onNavigate,
  showStandaloneLogout = false,
}: {
  onNavigate?: () => void;
  showStandaloneLogout?: boolean;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const fullName = user?.fullName ?? email.split("@")[0] ?? "";
  const initial = (fullName || email || "?").slice(0, 1).toUpperCase();

  const handleLogOut = () => {
    onNavigate?.();
    void usersService.signOutAudit().catch(() => undefined);
    clearAllNecDrafts();
    void signOut({ redirectUrl: ROUTES.PUBLIC.HOME }).catch(() => {
      window.location.assign(ROUTES.PUBLIC.HOME);
    });
  };

  return (
    <div
      className="border-t border-[var(--pv-hairline)] px-3 pb-4 pt-3"
      data-tour="dashboard-profile"
    >
      <IdentityPopover
        collapsed={false}
        content={
          <>
            <span className="relative shrink-0">
              {user?.imageUrl ? (
                // User avatar from Clerk is a dynamic external URL; next/image
                // would require remotePatterns config and offers little benefit
                // for a small avatar.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={fullName}
                  className="size-9 rounded-full object-cover"
                  src={user.imageUrl}
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-[var(--pv-tile)] text-[13px] font-semibold text-[var(--pv-text-body)]">
                  {initial}
                </span>
              )}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--pv-canvas)] bg-[var(--pv-online)]"
              />
            </span>
            {/* data-wg-notranslate: sidebar user block shows the signed-in
                name + email. PII must not enter Weglot's translation
                pipeline (see infra/cloudfront-weglot-proxy.md). */}
            <span data-wg-notranslate className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-1">
                <span className="truncate text-sm font-semibold text-[var(--pv-text-strong)]">
                  {fullName}
                </span>
                <HugeiconsIcon
                  className="shrink-0 text-[var(--pv-verified)]"
                  icon={CheckmarkBadge01Icon}
                  size={14}
                />
              </span>
              {email ? (
                <span className="block truncate text-xs text-[var(--pv-text-muted)]">
                  {email}
                </span>
              ) : null}
            </span>
            <HugeiconsIcon
              className="shrink-0 text-[var(--pv-text-muted)]"
              icon={ArrowRight01Icon}
              size={16}
            />
          </>
        }
        showLogout={!showStandaloneLogout}
        onNavigate={onNavigate}
      />
      {showStandaloneLogout ? (
        <button
          aria-label="Log out of PDFVault"
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          type="button"
          onClick={handleLogOut}
        >
          <HugeiconsIcon
            className="size-4 shrink-0 text-danger"
            icon={Logout03Icon}
          />
          <span>Log out</span>
        </button>
      ) : null}
    </div>
  );
}

function SidebarBody({
  isMobile = false,
  pathname,
  onNavigate,
}: {
  isMobile?: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const entitled = useIsEntitled();
  const { data: subscription } = useSubscriptionQuery();

  const handleUnlockClick = () => {
    onNavigate?.();
    if (!subscription || subscription.status === "NONE") {
      void requestPaywall(undefined, { hidePreview: true });
    } else {
      window.location.assign(ROUTES.APP.SETTINGS_BILLING);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link
          aria-label="PDFVault home"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2"
          href={ROUTES.PUBLIC.HOME}
          onClick={onNavigate}
        >
          <PdfVaultLogo />
        </Link>
      </div>
      <nav
        aria-label="Primary"
        className="flex flex-col gap-1 px-3"
        data-tour="dashboard-nav"
      >
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.label}
            active={item.isActive(pathname)}
            href={item.href}
            icon={item.icon}
            label={item.label}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <div className="mt-auto">
        <div className="border-t border-[var(--pv-hairline)] px-3 pb-1 pt-2">
          <TourHelpButton tour="dashboard" />
        </div>
        {entitled ? null : (
          <div className="border-t border-[var(--pv-hairline)] px-3 py-2">
            <button
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)]/60 hover:text-[var(--pv-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
              type="button"
              onClick={handleUnlockClick}
            >
              <HugeiconsIcon
                className="shrink-0 text-[var(--pv-brand-red)]"
                icon={SquareUnlock01Icon}
                size={18}
                strokeWidth={1.5}
              />
              <span>Unlock access</span>
            </button>
          </div>
        )}
        <div className="border-t border-[var(--pv-hairline)] px-3 py-2">
          <LanguageSwitcher />
        </div>
        <ProfileRow showStandaloneLogout={isMobile} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname() ?? "";
  const isMobile = useIsMobile();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  console.log(
    "[DashboardShell] render — pathname:",
    pathname,
    "isMobile:",
    isMobile,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

  // QA 2026-09-22 (issue #20, second follow-up): the dashboard tour's
  // "Quick tools" / "Account & settings" steps target elements that
  // live in different places on mobile — quick tools in `<main>`,
  // account/settings inside this drawer — so `tour-config.ts` dispatches
  // this event per step to open/close the drawer as the tour advances.
  // See `DASHBOARD_MOBILE_SIDEBAR_EVENT`'s own comment for the full
  // reasoning. A no-op on desktop: `isMobileOpen` is only read by the
  // mobile branch below.
  useEffect(() => {
    const onSetMobileSidebar = (event: Event) => {
      const open = (event as CustomEvent<{ open: boolean }>).detail?.open;

      if (typeof open === "boolean") setIsMobileOpen(open);
    };

    window.addEventListener(DASHBOARD_MOBILE_SIDEBAR_EVENT, onSetMobileSidebar);

    return () =>
      window.removeEventListener(
        DASHBOARD_MOBILE_SIDEBAR_EVENT,
        onSetMobileSidebar,
      );
  }, []);

  if (!isMobile) {
    return (
      <div className="pv-dashboard flex h-screen w-full overflow-hidden">
        <aside className="flex h-full w-[250px] shrink-0 flex-col bg-[var(--pv-canvas)]">
          <SidebarBody pathname={pathname} />
        </aside>
        <main className="flex-1 overflow-hidden p-4 pl-0">
          <div className="h-full w-full overflow-y-auto rounded-3xl border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-8 py-4">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="pv-dashboard flex h-screen w-full flex-col overflow-hidden">
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
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[var(--pv-canvas)] shadow-xl transition-transform duration-200 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          aria-label="Close navigation"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-[var(--pv-text-body)] hover:bg-[var(--pv-nav-active)]"
          type="button"
          onClick={() => setIsMobileOpen(false)}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
        <SidebarBody
          isMobile
          pathname={pathname}
          onNavigate={() => setIsMobileOpen(false)}
        />
      </aside>

      <div className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--pv-hairline)] bg-[var(--pv-canvas)] px-3">
        <button
          aria-controls="dashboard-mobile-sidebar"
          aria-expanded={isMobileOpen}
          aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
          className="flex size-9 items-center justify-center rounded-lg text-[var(--pv-text-body)] hover:bg-[var(--pv-nav-active)]"
          type="button"
          onClick={() => setIsMobileOpen((open) => !open)}
        >
          <HugeiconsIcon
            icon={isMobileOpen ? Cancel01Icon : Menu01Icon}
            size={20}
          />
        </button>
        <Link
          aria-label="PDFVault home"
          className="flex items-center"
          href={ROUTES.PUBLIC.HOME}
        >
          <PdfVaultLogo />
        </Link>
      </div>

      <main className="flex-1 overflow-hidden p-3">
        <div className="h-full w-full overflow-y-auto rounded-2xl border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-4 py-3">
          {children}
        </div>
      </main>
    </div>
  );
}
