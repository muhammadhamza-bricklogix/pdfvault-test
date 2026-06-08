"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowDown01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer, Dropdown, Label, Separator } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";

const PDF_TOOL_LINKS = [
  { href: `${ROUTES.PUBLIC.HOME}#pdf-tools`, label: "All tools overview" },
  { href: ROUTES.TOOLS.PDF_EDITOR, label: "PDF editor" },
  { href: ROUTES.TOOLS.PDF_TO_EXCEL, label: "PDF to Excel" },
] as const;

const DRAWER_LINKS = [
  ...PDF_TOOL_LINKS,
  { href: ROUTES.LEGAL.CONTACT, label: "Contact" },
  { href: ROUTES.PUBLIC.HOME, label: "Home" },
] as const;

export function SiteNavbar() {
  const router = useRouter();
  // `isLoaded` gates auth-conditional buttons so the server-rendered shell
  // matches the first client render. Both branches are hidden until Clerk has
  // hydrated, preventing the "scripts inside React components" warning that
  // Clerk's `<Show>` component triggers and the auth-state flicker on slow
  // connections.
  const { isLoaded, isSignedIn } = useAuth();
  const showSignedOut = isLoaded && !isSignedIn;
  const showSignedIn = isLoaded && isSignedIn;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-default-200/80 bg-[var(--color-background)]/90 backdrop-blur-md dark:border-default-800/80">
      <div className="mx-auto flex w-full max-w-[min(100%,104rem)] items-center gap-4 px-6 py-3.5 sm:px-8">
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
                  <Drawer.Heading className="flex items-center gap-2">
                    <Image
                      priority
                      alt="PDFedits logo"
                      className="size-9 object-contain"
                      height={36}
                      src="/logo.svg"
                      width={36}
                    />
                    <span className="text-lg font-bold">
                      <span className="text-[var(--color-accent)]">PDF</span>
                      <span className="text-[var(--color-foreground)]">
                        edits
                      </span>
                    </span>
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <nav className="flex flex-col gap-1">
                    {DRAWER_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-default-500 transition-colors hover:bg-default-100 hover:text-foreground"
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <Separator className="my-4" />

                  <div className="flex flex-col gap-3 px-3">
                    <ThemeToggle />

                    {showSignedOut ? (
                      <>
                        <Button
                          className="w-full"
                          variant="ghost"
                          onPress={() => router.push(ROUTES.AUTH.SIGN_IN)}
                        >
                          Sign in
                        </Button>
                        <Button
                          className="w-full bg-gradient-to-r from-[var(--color-accent)] to-red-600 font-semibold text-white shadow-sm"
                          onPress={() => router.push(ROUTES.AUTH.SIGN_UP)}
                        >
                          Sign up free
                        </Button>
                      </>
                    ) : null}

                    {showSignedIn ? (
                      <Button
                        className="w-full"
                        variant="outline"
                        onPress={() => router.push(ROUTES.APP.DASHBOARD)}
                      >
                        Dashboard
                      </Button>
                    ) : null}
                  </div>
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <Link
          className="flex shrink-0 items-center gap-2.5"
          href={ROUTES.PUBLIC.HOME}
        >
          <Image
            priority
            alt="PDFedits logo"
            className="size-9 object-contain sm:size-10"
            height={40}
            src="/logo.svg"
            width={40}
          />
          <span className="text-lg font-bold tracking-tight sm:text-xl">
            <span className="text-[var(--color-accent)]">PDF</span>
            <span className="text-[var(--color-foreground)]">edits</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="hidden lg:block">
            <Dropdown>
              <Button
                className="gap-1 font-medium text-default-600 dark:text-default-400"
                variant="ghost"
              >
                All PDF tools
                <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
              </Button>
              <Dropdown.Popover className="min-w-[220px]">
                <Dropdown.Menu aria-label="PDF tools">
                  {PDF_TOOL_LINKS.map((item) => (
                    <Dropdown.Item
                      key={item.href}
                      href={item.href}
                      id={item.href}
                      textValue={item.label}
                    >
                      <Label>{item.label}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>

          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          {showSignedOut ? (
            <>
              <Link
                className="hidden px-2 text-sm font-medium text-default-600 transition-colors hover:text-foreground sm:inline-flex dark:text-default-400"
                href={ROUTES.AUTH.SIGN_IN}
              >
                Sign in
              </Link>
              <Button
                className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-red-600 px-5 font-semibold text-white shadow-sm shadow-red-200 transition-shadow hover:shadow-red-300 dark:shadow-red-900/30"
                onPress={() => router.push(ROUTES.AUTH.SIGN_UP)}
              >
                Sign up free
              </Button>
            </>
          ) : null}

          {showSignedIn ? (
            <Button
              className="rounded-lg font-medium"
              variant="outline"
              onPress={() => router.push(ROUTES.APP.DASHBOARD)}
            >
              Dashboard
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
