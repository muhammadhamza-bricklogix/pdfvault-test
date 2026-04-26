"use client";

import { Clock01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

const NAV_ITEMS = [
  {
    href: ROUTES.APP.DASHBOARD,
    icon: File01Icon,
    label: "My Documents",
  },
  {
    href: `${ROUTES.APP.DASHBOARD}?filter=recents`,
    icon: Clock01Icon,
    label: "Recents",
    matchSearch: "filter=recents",
  },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav className="sticky top-6 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const href = item.href;
          const isActive =
            "matchSearch" in item
              ? false
              : pathname === ROUTES.APP.DASHBOARD;

          return (
            <Link
              key={item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--app-surface)] text-[var(--color-foreground)]"
                  : "text-[var(--app-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--color-foreground)]"
              }`}
              href={href}
            >
              <HugeiconsIcon icon={item.icon} size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
