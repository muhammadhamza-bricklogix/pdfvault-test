"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  Clock01Icon,
  File01Icon,
  HelpCircleIcon,
  Logout03Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Setting07Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { useDashboardUiStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";

const PRIMARY_NAV = [
  {
    href: ROUTES.APP.DASHBOARD,
    icon: File01Icon,
    label: "My Documents",
  },
  {
    href: `${ROUTES.APP.DASHBOARD}?filter=recents`,
    icon: Clock01Icon,
    label: "Recents",
  },
] as const;

type IconType = typeof File01Icon;

type SidebarNavItemProps = {
  collapsed: boolean;
  href: string;
  icon: IconType;
  isActive: boolean;
  label: string;
  onNavigate?: () => void;
};

function SidebarNavItem({
  collapsed,
  href,
  icon,
  isActive,
  label,
  onNavigate,
}: SidebarNavItemProps) {
  const link = (
    <Link
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-[var(--app-surface)] text-[var(--color-foreground)]"
          : "text-[var(--app-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--color-foreground)]"
      } ${collapsed ? "justify-center" : ""}`}
      href={href}
      onClick={onNavigate}
    >
      <HugeiconsIcon icon={icon} size={18} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delay={300}>
      {link}
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

type SidebarBodyProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

export function SidebarBody({ collapsed, onNavigate }: SidebarBodyProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const toggleCollapsed = useDashboardUiStore((s) => s.toggleSidebarCollapsed);

  return (
    <div className="flex h-full flex-col">
      {/* Header: logo + collapse toggle */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-[var(--app-border)] px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <Link
            className="text-xl font-semibold tracking-tight"
            href={ROUTES.PUBLIC.HOME}
          >
            <span className="text-[var(--color-accent)]">pdf</span>
            <span className="text-[var(--color-foreground)]">forge</span>
          </Link>
        )}
        <Tooltip delay={300}>
          <Button
            isIconOnly
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:inline-flex"
            size="sm"
            variant="ghost"
            onPress={toggleCollapsed}
          >
            <HugeiconsIcon
              icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
              size={18}
            />
          </Button>
          <Tooltip.Content>
            <p>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>

      {/* Identity block */}
      <Link
        className={`flex shrink-0 items-center gap-3 border-b border-[var(--app-border)] px-3 py-3 transition-colors hover:bg-[var(--app-surface)] ${
          collapsed ? "justify-center" : ""
        }`}
        href={`${ROUTES.APP.DASHBOARD}/account`}
        onClick={onNavigate}
      >
        {user?.imageUrl ? (
          <img
            alt={user.fullName ?? "Avatar"}
            className="size-9 shrink-0 rounded-full object-cover"
            src={user.imageUrl}
          />
        ) : (
          <HugeiconsIcon icon={UserCircleIcon} size={36} />
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
              {user?.fullName ?? "User"}
            </p>
            <p className="truncate text-xs text-[var(--app-muted)]">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
          </div>
        )}
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {PRIMARY_NAV.map((item) => (
          <SidebarNavItem
            key={item.label}
            collapsed={collapsed}
            href={item.href}
            icon={item.icon}
            isActive={
              pathname === ROUTES.APP.DASHBOARD && !item.href.includes("filter")
            }
            label={item.label}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Footer: theme + settings + help + logout */}
      <div
        className={`flex shrink-0 flex-col gap-1 border-t border-[var(--app-border)] p-3 ${
          collapsed ? "items-center" : ""
        }`}
      >
        <div className={collapsed ? "" : "px-1 pb-1"}>
          <ThemeToggle size="sm" variant="ghost" />
        </div>

        {collapsed ? (
          <Tooltip delay={300}>
            <Button
              isIconOnly
              aria-label="Log out"
              size="sm"
              variant="ghost"
              onPress={() => signOut()}
            >
              <HugeiconsIcon icon={Logout03Icon} size={18} />
            </Button>
            <Tooltip.Content>
              <p>Log out</p>
            </Tooltip.Content>
          </Tooltip>
        ) : (
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--color-foreground)]"
            type="button"
            onClick={() => signOut()}
          >
            <HugeiconsIcon icon={Logout03Icon} size={18} />
            <span>Log out</span>
          </button>
        )}
      </div>
    </div>
  );
}
