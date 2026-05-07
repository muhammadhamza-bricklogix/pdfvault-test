"use client";

import {
  File01Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDashboardUiStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";

import { IdentityPopover } from "./identity-popover";

const PRIMARY_NAV = [
  {
    href: ROUTES.APP.DASHBOARD,
    icon: File01Icon,
    label: "My Documents",
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
          ? "bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
          : "text-default-500 hover:bg-default-100 hover:text-[var(--color-foreground)]"
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
  const pathname = usePathname();
  const toggleCollapsed = useDashboardUiStore((s) => s.toggleSidebarCollapsed);

  return (
    <div className="flex h-full flex-col border-r border-default-200">
      {/* Header: logo + collapse toggle */}
      <div
        className={`flex h-14 shrink-0 items-center px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <Link
            className="flex items-center gap-2 text-xl font-semibold tracking-tight"
            href={ROUTES.PUBLIC.HOME}
          >
            <Image
              priority
              alt="PDFedits logo"
              className="size-8 object-contain"
              height={32}
              src="/logo.svg"
              width={32}
            />
            <span>
              <span className="text-[var(--color-accent)]">PDF</span>
              <span className="text-[var(--color-foreground)]">edits</span>
            </span>
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

      {/* Bottom: identity popover */}
      <div className="shrink-0 p-2">
        <IdentityPopover collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
