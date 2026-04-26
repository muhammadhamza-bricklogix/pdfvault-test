"use client";

import type { ReactNode } from "react";

import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useDashboardUiStore } from "@/lib/client/stores";

import { SidebarBody } from "./dashboard-sidebar";

type DashboardShellProps = {
    children: ReactNode;
};

const PAGE_TITLES: Record<string, string> = {
    "/dashboard": "My Documents",
};

export function DashboardShell({ children }: DashboardShellProps) {
    const pathname = usePathname();
    const isCollapsed = useDashboardUiStore((s) => s.isSidebarCollapsed);
    const isMobileOpen = useDashboardUiStore((s) => s.isMobileDrawerOpen);
    const setMobileOpen = useDashboardUiStore((s) => s.setMobileDrawerOpen);

    // Auto-close mobile drawer on route change.
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname, setMobileOpen]);

    const pageTitle = PAGE_TITLES[pathname ?? ""] ?? "Dashboard";

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[var(--color-background)]">
            {/* Desktop sidebar */}
            <aside
                className={`hidden shrink-0 border-r border-[var(--app-border)] bg-[var(--color-background)] transition-[width] duration-200 lg:block ${isCollapsed ? "w-16" : "w-60"
                    }`}
            >
                <SidebarBody collapsed={isCollapsed} />
            </aside>

            {/* Mobile drawer */}
            <Drawer isOpen={isMobileOpen} onOpenChange={setMobileOpen}>
                <Drawer.Backdrop>
                    <Drawer.Content placement="left">
                        <Drawer.Dialog className="!w-72">
                            <SidebarBody
                                collapsed={false}
                                onNavigate={() => setMobileOpen(false)}
                            />
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>

            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Mobile top bar */}
                <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--app-border)] px-4 lg:hidden">
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

                <main className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
