"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { Button } from "@heroui/react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";

const NAV_ITEMS = [
  "Edit & Sign",
  "Convert",
  "Forms",
  "PDF Templates",
  "AI PDF Summarizer",
];

export function SiteNavbar() {
  return (
    <header className="border-b bg-[var(--color-background)]">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-4 sm:px-8">
        <Link
          className="shrink-0 text-2xl font-semibold tracking-tight"
          href={ROUTES.PUBLIC.HOME}
        >
          <span className="text-[var(--color-accent)]">pdf</span>
          <span className="text-[var(--color-foreground)]">forge</span>
        </Link>

        <nav className="mx-auto hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item}
              className="text-sm font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--color-foreground)]"
              href={ROUTES.PUBLIC.HOME}
            >
              {item}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />

          <Show when="signed-out">
            <Link
              className="hidden text-sm font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--color-foreground)] sm:inline-flex"
              href={ROUTES.AUTH.SIGN_IN}
            >
              Sign in
            </Link>
            <Link href={ROUTES.AUTH.SIGN_UP}>
              <Button className="rounded-full" variant="outline">
                Create account
              </Button>
            </Link>
          </Show>

          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
