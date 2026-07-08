"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

type SettingsSection = {
  href: string;
  id: string;
  label: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: ROUTES.APP.SETTINGS_GENERAL,
    id: "general",
    label: "General",
  },
  {
    href: ROUTES.APP.SETTINGS_ACCOUNT,
    id: "account",
    label: "Account",
  },
  {
    href: ROUTES.APP.SETTINGS_LANGUAGE,
    id: "language",
    label: "Language & Region",
  },
  {
    href: ROUTES.APP.SETTINGS_DANGER,
    id: "danger",
    label: "Danger Zone",
  },
];

interface SettingsNavProps {
  /**
   * Retained for API compatibility with the previous vertical/horizontal
   * variants — the new design uses a single segmented pill regardless of
   * viewport, so both values render the same control.
   */
  orientation?: "vertical" | "horizontal";
}

/**
 * Segmented pill from the Settings frames (Frame 2043684300 / -1).
 * Active tab = white capsule with a subtle border sitting inside a
 * `--pv-nav-active` (#F3F3F5) track. Inactive tabs are muted body text.
 * Scrolls horizontally on narrow viewports so all four tabs stay reachable.
 */
export function SettingsNav(_props: SettingsNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Settings sections" className="overflow-x-auto">
      <div className="inline-flex gap-1 rounded-full bg-[var(--pv-nav-active)] p-1">
        {SETTINGS_SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);

          return (
            <Link
              key={section.id}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] ${
                active
                  ? "bg-[var(--pv-surface)] text-[var(--pv-text-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                  : "text-[var(--pv-text-body)] hover:text-[var(--pv-text-strong)]"
              }`}
              href={section.href}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
