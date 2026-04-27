"use client";

import {
  AlertCircleIcon,
  Globe02Icon,
  Setting07Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname, useRouter } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

type SettingsSection = {
  description: string;
  href: string;
  icon: typeof Setting07Icon;
  id: string;
  label: string;
  tone?: "danger";
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    description: "Profile and basic info",
    href: ROUTES.APP.SETTINGS_GENERAL,
    icon: Setting07Icon,
    id: "general",
    label: "General",
  },
  {
    description: "Email, password, sessions",
    href: ROUTES.APP.SETTINGS_ACCOUNT,
    icon: UserCircleIcon,
    id: "account",
    label: "Account",
  },
  {
    description: "Language, timezone, formats",
    href: ROUTES.APP.SETTINGS_LANGUAGE,
    icon: Globe02Icon,
    id: "language",
    label: "Language & Region",
  },
  {
    description: "Delete account",
    href: ROUTES.APP.SETTINGS_DANGER,
    icon: AlertCircleIcon,
    id: "danger",
    label: "Danger zone",
    tone: "danger",
  },
];

const resolveActiveId = (pathname: string) => {
  const match = SETTINGS_SECTIONS.find((s) => pathname.startsWith(s.href));

  return match?.id ?? "general";
};

type SettingsNavProps = {
  orientation: "horizontal" | "vertical";
};

export function SettingsNav({ orientation }: SettingsNavProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const selected = resolveActiveId(pathname);

  if (orientation === "horizontal") {
    return (
      <nav
        aria-label="Settings sections"
        className="flex min-w-max items-center gap-1 py-2"
      >
        {SETTINGS_SECTIONS.map((section) => {
          const isActive = selected === section.id;
          const isDanger = section.tone === "danger";

          return (
            <button
              key={section.id}
              aria-current={isActive ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? isDanger
                    ? "bg-[var(--app-surface)] text-[var(--app-danger,#dc2626)]"
                    : "bg-[var(--app-surface)] text-[var(--color-foreground)]"
                  : isDanger
                    ? "text-[var(--app-danger,#dc2626)] hover:bg-[var(--app-surface)]"
                    : "text-[var(--app-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--color-foreground)]"
              }`}
              type="button"
              onClick={() => router.push(section.href)}
            >
              {section.label}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-1">
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = selected === section.id;
        const isDanger = section.tone === "danger";

        return (
          <button
            key={section.id}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
              isActive
                ? isDanger
                  ? "bg-[var(--app-surface)] text-[var(--app-danger,#dc2626)]"
                  : "bg-[var(--app-surface)] text-[var(--color-foreground)]"
                : isDanger
                  ? "text-[var(--app-danger,#dc2626)] hover:bg-[var(--app-surface)]"
                  : "text-[var(--app-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--color-foreground)]"
            }`}
            type="button"
            onClick={() => router.push(section.href)}
          >
            <HugeiconsIcon
              className="mt-0.5 shrink-0"
              icon={section.icon}
              size={17}
            />
            <span className="min-w-0 flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">
                {section.label}
              </span>
              <span className="text-xs leading-4 text-[var(--app-muted)]">
                {section.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
