"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  HelpCircleIcon,
  LegalDocumentIcon,
  Logout03Icon,
  PaintBucketIcon,
  Setting07Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Description, Label, ListBox, Popover } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeSegmented } from "@/components/ui/theme/theme-segmented";
import { usersService } from "@/lib/shared/api/services/users.service";
import { ROUTES } from "@/lib/shared/constants/routes";

type IdentityPopoverProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

export function IdentityPopover({
  collapsed,
  onNavigate,
}: IdentityPopoverProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const fullName = user?.fullName ?? "User";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const avatarSize = collapsed ? "size-8" : "size-9";
  const avatarPx = collapsed ? 32 : 36;
  const avatar = user?.imageUrl ? (
    <img
      alt={fullName}
      className={`${avatarSize} shrink-0 rounded-full object-cover`}
      src={user.imageUrl}
    />
  ) : (
    <HugeiconsIcon icon={UserCircleIcon} size={avatarPx} />
  );

  const handleAction = (key: React.Key) => {
    const k = String(key);

    if (k === "settings") {
      setIsOpen(false);
      router.push(ROUTES.APP.SETTINGS);
      onNavigate?.();
    } else if (k === "terms") {
      setIsOpen(false);
      router.push(ROUTES.LEGAL.TERMS);
      onNavigate?.();
    } else if (k === "help") {
      setIsOpen(false);
      router.push(ROUTES.LEGAL.CONTACT);
      onNavigate?.();
    } else if (k === "logout") {
      setIsOpen(false);
      // Fire-and-forget the backend audit BEFORE Clerk destroys the JWT —
      // afterwards our axios interceptor wouldn't have a token to attach
      // and the call would 401. Failure is intentionally swallowed: nothing
      // should block the user from signing out.
      void usersService.signOutAudit().catch(() => undefined);
      void signOut();
    }
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger
        aria-label="Account menu"
        className={
          collapsed
            ? // Sidebar variant — tight circular avatar button. `w-full` was
              // breaking layouts when rendered inside flex/grid containers.
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-default-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            : "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-default-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        }
      >
        {avatar}
      </Popover.Trigger>
      <Popover.Content offset={8} placement="right-end">
        <Popover.Dialog className="!min-w-[280px] !p-0">
          {/* Profile details header — name + email, set apart from the
              action list with bottom padding instead of a divider so the
              popover reads as one calm group. */}
          <div className="px-4 pb-3 pt-4">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              Profile Details
            </p>
            {fullName !== "User" ? (
              <p className="mt-0.5 truncate text-xs text-default-700">
                {fullName}
              </p>
            ) : null}
            {email ? (
              <p className="truncate text-xs text-default-500">{email}</p>
            ) : null}
          </div>

          <ListBox
            aria-label="Account actions"
            className="px-2 pb-1"
            selectionMode="none"
            onAction={handleAction}
          >
            <ListBox.Item id="settings" textValue="Settings">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-600"
                  icon={Setting07Icon}
                />
              </div>
              <div className="flex flex-col">
                <Label>Settings</Label>
                <Description>Profile, account, preferences</Description>
              </div>
            </ListBox.Item>

            <ListBox.Item id="theme" textValue="Theme">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-600"
                  icon={PaintBucketIcon}
                />
              </div>
              <div className="flex w-full items-center justify-between gap-4">
                <Label>Theme</Label>
                <ThemeSegmented size="sm" />
              </div>
            </ListBox.Item>

            <ListBox.Item id="help" textValue="Help">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-600"
                  icon={HelpCircleIcon}
                />
              </div>
              <Label>Help</Label>
            </ListBox.Item>

            <ListBox.Item id="terms" textValue="Terms and Conditions">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-600"
                  icon={LegalDocumentIcon}
                />
              </div>
              <Label>Terms and Conditions</Label>
            </ListBox.Item>
          </ListBox>

          <ListBox
            aria-label="Session"
            className="border-t border-default-200 px-2 pb-2 pt-1"
            selectionMode="none"
            onAction={handleAction}
          >
            <ListBox.Item id="logout" textValue="Log out" variant="danger">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-danger"
                  icon={Logout03Icon}
                />
              </div>
              <Label>Log out</Label>
            </ListBox.Item>
          </ListBox>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
