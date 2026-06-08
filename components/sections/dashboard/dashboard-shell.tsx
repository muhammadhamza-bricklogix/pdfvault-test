"use client";

import type { ReactNode } from "react";

import { Setting07Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

import { IdentityPopover } from "./identity-popover";

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
  const router = useRouter();

  const pageTitle =
    PAGE_TITLES.find((entry) => entry.match(pathname ?? ""))?.title ??
    "Dashboard";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-background)]">
      {/*
        Sidebar removed — with Activity hidden behind a backend gap and
        "My Documents" being the only remaining destination, the rail added
        no navigational value. Settings now lives as an explicit icon next
        to the account avatar in this top bar.
      */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-default-200 bg-default-100/35 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Go to home"
            className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight"
            href={ROUTES.PUBLIC.HOME}
          >
            <Image
              priority
              alt="PDFedits logo"
              className="size-7 object-contain"
              height={28}
              src="/logo.svg"
              width={28}
            />
            <span className="hidden sm:inline">
              <span className="text-[var(--color-accent)]">PDF</span>
              <span className="text-[var(--color-foreground)]">edits</span>
            </span>
          </Link>
          <span
            aria-hidden
            className="hidden h-5 w-px shrink-0 bg-default-300 sm:block"
          />
          <h1 className="truncate text-base font-semibold text-[var(--color-foreground)]">
            {pageTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip delay={300}>
            <Button
              isIconOnly
              aria-label="Settings"
              size="sm"
              variant="ghost"
              onPress={() => router.push(ROUTES.APP.SETTINGS)}
            >
              <HugeiconsIcon icon={Setting07Icon} size={18} />
            </Button>
            <Tooltip.Content>
              <p>Settings</p>
            </Tooltip.Content>
          </Tooltip>
          <IdentityPopover collapsed />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
