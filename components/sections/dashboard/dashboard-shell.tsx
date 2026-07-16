"use client";

import type { ReactNode } from "react";

import {
  ArrowRight01Icon,
  BankIcon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  Menu01Icon,
  MenuSquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useUser } from "@clerk/nextjs";
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

type IconGlyph = typeof BankIcon;

type NavItem = {
  href: string;
  icon: IconGlyph;
  isActive: (pathname: string) => boolean;
  label: string;
};

const DASHBOARD_TOOLS_PATH = "/dashboard/tools";

const NAV_ITEMS: readonly NavItem[] = [
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
        <span className="text-[var(--pv-text-muted)]">Vault</span>
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
function ProfileRow({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useUser();
  const fullName = user?.fullName ?? "Guest";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div className="border-t border-[var(--pv-hairline)] px-3 pb-4 pt-3">
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
                  {fullName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--pv-canvas)] bg-[var(--pv-online)]"
              />
            </span>
            <span className="min-w-0 flex-1 text-left">
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
        onNavigate={onNavigate}
      />
    </div>
  );
}

function SidebarBody({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link
          aria-label="PDFVault dashboard"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2"
          href={ROUTES.APP.DASHBOARD}
          onClick={onNavigate}
        >
          <PdfVaultLogo />
        </Link>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-1 px-3">
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
        <ProfileRow onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname() ?? "";
  const isMobile = useIsMobile();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  if (!isMobile) {
    return (
      <div className="pv-dashboard flex h-screen w-full overflow-hidden">
        <aside className="flex h-full w-[250px] shrink-0 flex-col bg-[var(--pv-canvas)]">
          <SidebarBody pathname={pathname} />
        </aside>
        <main className="flex-1 overflow-hidden p-4 pl-0">
          <div className="h-full w-full overflow-y-auto rounded-3xl border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-8 py-7">
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
          aria-label="PDFVault dashboard"
          className="flex items-center"
          href={ROUTES.APP.DASHBOARD}
        >
          <PdfVaultLogo />
        </Link>
      </div>

      <main className="flex-1 overflow-hidden p-3">
        <div className="h-full w-full overflow-y-auto rounded-2xl border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-4 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
