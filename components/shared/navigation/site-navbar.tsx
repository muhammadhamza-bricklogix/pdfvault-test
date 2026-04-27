"use client";

import { Show } from "@clerk/nextjs";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer, Separator } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";

const NAV_ITEMS = [
  { href: ROUTES.TOOLS.PDF_EDITOR, label: "PDF Editor" },
  { href: ROUTES.PUBLIC.HOME, label: "Conversions" },
  { href: ROUTES.PUBLIC.HOME, label: "Compress" },
  { href: ROUTES.PUBLIC.HOME, label: "Protect" },
];

export function SiteNavbar() {
  const router = useRouter();

  return (
    <header className="border-b bg-[var(--color-background)]">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-4 sm:px-8">
        {/* Mobile hamburger */}
        <Drawer>
          <Button
            isIconOnly
            aria-label="Open navigation menu"
            className="lg:hidden"
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon icon={Menu01Icon} size={20} />
          </Button>
          <Drawer.Backdrop>
            <Drawer.Content placement="left">
              <Drawer.Dialog>
                <Drawer.CloseTrigger />
                <Drawer.Header>
                  <Drawer.Heading>
                    <span className="text-[var(--color-accent)]">pdf</span>
                    <span className="text-[var(--color-foreground)]">
                      forge
                    </span>
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <nav className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--color-foreground)]"
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <Separator className="my-4" />

                  <div className="flex flex-col gap-3 px-3">
                    <ThemeToggle />

                    <Show when="signed-out">
                      <Button
                        className="w-full"
                        variant="ghost"
                        onPress={() => router.push(ROUTES.AUTH.SIGN_IN)}
                      >
                        Sign in
                      </Button>
                      <Button
                        className="w-full"
                        variant="outline"
                        onPress={() => router.push(ROUTES.AUTH.SIGN_UP)}
                      >
                        Create account
                      </Button>
                    </Show>

                    <Show when="signed-in">
                      <Button
                        className="w-full"
                        variant="outline"
                        onPress={() => router.push(ROUTES.APP.DASHBOARD)}
                      >
                        Dashboard
                      </Button>
                    </Show>
                  </div>
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        {/* Logo */}
        <Link
          className="shrink-0 text-2xl font-semibold tracking-tight"
          href={ROUTES.PUBLIC.HOME}
        >
          <span className="text-[var(--color-accent)]">pdf</span>
          <span className="text-[var(--color-foreground)]">forge</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="mx-auto hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              className="text-sm font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--color-foreground)]"
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side: theme, auth */}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          <Show when="signed-out">
            <Link
              className="hidden text-sm font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--color-foreground)] sm:inline-flex"
              href={ROUTES.AUTH.SIGN_IN}
            >
              Sign in
            </Link>
            <Button
              className="rounded-full"
              variant="outline"
              onPress={() => router.push(ROUTES.AUTH.SIGN_UP)}
            >
              Create account
            </Button>
          </Show>

          <Show when="signed-in">
            <Button
              className="rounded-full"
              variant="outline"
              onPress={() => router.push(ROUTES.APP.DASHBOARD)}
            >
              Dashboard
            </Button>
          </Show>
        </div>
      </div>
    </header>
  );
}
