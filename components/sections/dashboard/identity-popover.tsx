"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  ArrowUp01Icon,
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

  const avatar = user?.imageUrl ? (
    <img
      alt={fullName}
      className="size-9 shrink-0 rounded-full object-cover"
      src={user.imageUrl}
    />
  ) : (
    <HugeiconsIcon icon={UserCircleIcon} size={36} />
  );

  const handleAction = (key: React.Key) => {
    if (key === "settings") {
      setIsOpen(false);
      router.push(ROUTES.APP.SETTINGS);
      onNavigate?.();
    } else if (key === "logout") {
      setIsOpen(false);
      void signOut();
    }
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger
        aria-label="Account menu"
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-default-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${collapsed ? "justify-center" : ""
          }`}
      >
        {avatar}
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                {fullName}
              </p>
              <p className="truncate text-xs text-default-500">
                {email}
              </p>
            </div>
            <HugeiconsIcon
              className="text-default-500"
              icon={ArrowUp01Icon}
              size={14}
            />
          </>
        )}
      </Popover.Trigger>
      <Popover.Content offset={8} placement={"top"}>
        <Popover.Dialog>
          {email && (
            <p className=" pb-2 pt-2 text-xs text-default-500">
              {email}
            </p>
          )}

          <ListBox
            aria-label="Account actions"
            className="p-0 pb-2"
            selectionMode="none"
            onAction={handleAction}
          >
            <ListBox.Item id="settings" textValue="Settings">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-500"
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
                  className="size-4 shrink-0 text-default-500"
                  icon={PaintBucketIcon}
                />
              </div>
              <div className="flex w-full items-center justify-between gap-4">
                <Label>Theme</Label>
                <ThemeSegmented size="sm" />
              </div>
            </ListBox.Item>
          </ListBox>

          <ListBox
            aria-label="Session"
            className="border-t border-default-200 p-0 pt-2"
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
              <div className="flex flex-col">
                <Label>Log out</Label>
              </div>
            </ListBox.Item>
          </ListBox>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
