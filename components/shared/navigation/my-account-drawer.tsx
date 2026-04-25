"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Drawer, Separator } from "@heroui/react";

export function MyAccountDrawer() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <Drawer>
      <Button
        isIconOnly
        aria-label="My account"
        className="size-8 min-w-0 overflow-hidden rounded-full ring-2 ring-transparent transition-shadow hover:ring-[var(--color-accent)]"
        variant="ghost"
      >
        {user?.imageUrl ? (
          <img
            alt={user.fullName ?? "Avatar"}
            className="size-full object-cover"
            src={user.imageUrl}
          />
        ) : (
          <HugeiconsIcon icon={UserCircleIcon} size={28} />
        )}
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>My Account</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-col items-center gap-3 py-4">
                {user?.imageUrl && (
                  <img
                    alt={user.fullName ?? "Avatar"}
                    className="size-16 rounded-full object-cover"
                    src={user.imageUrl}
                  />
                )}
                <p className="text-lg font-semibold text-[var(--color-foreground)]">
                  {user?.fullName ?? "User"}
                </p>
                <p className="text-sm text-[var(--app-muted)]">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Button
                  isDisabled
                  className="w-full justify-start"
                  variant="ghost"
                >
                  My PDFs (Coming Soon)
                </Button>
              </div>
            </Drawer.Body>
            <Drawer.Footer>
              <Button
                className="w-full"
                variant="outline"
                onPress={() => signOut()}
              >
                Sign Out
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
