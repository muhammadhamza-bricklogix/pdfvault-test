"use client";

import type { ReactNode } from "react";

import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useDashboardUiStore } from "@/lib/client/stores";

import { SidebarBody } from "./dashboard-sidebar";

type DashboardShellProps = {
  children: ReactNode;
};

const PAGE_TITLES: { match: (pathname: string) => boolean; title: string }[] = [
  {
    match: (p) => p.startsWith("/dashboard/settings"),
    title: "Settings",
  },
  {
    match: (p) => p === "/dashboard/activity",
    title: "Activity",
  },
  {
    match: (p) => p === "/dashboard",
    title: "My Documents",
  },
];

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const isCollapsed = useDashboardUiStore((s) => s.isSidebarCollapsed);
  const isMobileOpen = useDashboardUiStore((s) => s.isMobileDrawerOpen);
  const setMobileOpen = useDashboardUiStore((s) => s.setMobileDrawerOpen);

  // Auto-close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Lock background scroll when the mobile drawer is open.
  useEffect(() => {
    if (!isMobileOpen) return;
    const prev = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileOpen]);

  const pageTitle =
    PAGE_TITLES.find((entry) => entry.match(pathname ?? ""))?.title ??
    "Dashboard";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-background)]">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 bg-default-100/35 transition-[width] duration-200 lg:block ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarBody collapsed={isCollapsed} />
      </aside>

      {/* Mobile drawer — fixed overlay with backdrop. Custom rather than
          HeroUI's <Drawer> because the latter occasionally renders inline on
          iOS Safari, pushing page content instead of overlaying it. */}
      {isMobileOpen ? (
        <div aria-modal className="fixed inset-0 z-50 lg:hidden" role="dialog">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            type="button"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-[var(--color-background)] shadow-xl">
            <div className="flex items-center justify-end px-2 pt-2">
              <Button
                isIconOnly
                aria-label="Close navigation"
                size="sm"
                variant="ghost"
                onPress={() => setMobileOpen(false)}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarBody
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 bg-default-100/35 px-4 lg:hidden">
          <Button
            isIconOnly
            aria-label="Open navigation"
            size="sm"
            variant="ghost"
            onPress={() => setMobileOpen(true)}
          >
            <HugeiconsIcon icon={Menu01Icon} size={20} />
          </Button>
          <h1 className="truncate text-base font-semibold">{pageTitle}</h1>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
