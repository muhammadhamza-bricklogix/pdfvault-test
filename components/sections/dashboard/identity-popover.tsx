"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  HelpCircleIcon,
  LegalDocumentIcon,
  Logout03Icon,
  Setting07Icon,
  SquareUnlock01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Description, Label, ListBox, Popover } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useIsEntitled } from "@/lib/client/hooks/billing/use-is-entitled";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { useSubscriptionQuery } from "@/lib/client/query/queries/billing.query";
import { usersService } from "@/lib/shared/api/services/users.service";
import { ROUTES } from "@/lib/shared/constants/routes";

type IdentityPopoverProps = {
  collapsed: boolean;
  /**
   * Override the trigger content. When set, replaces the default avatar-only
   * button — used by the expanded sidebar's profile row (avatar + name +
   * verified badge + email + chevron all in one clickable target).
   */
  content?: React.ReactNode;
  onNavigate?: () => void;
};

export function IdentityPopover({
  collapsed,
  content,
  onNavigate,
}: IdentityPopoverProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const entitled = useIsEntitled();
  const { data: subscription } = useSubscriptionQuery();

  const fullName = user?.fullName ?? "User";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const avatarSize = collapsed ? "size-8" : "size-9";
  const avatarPx = collapsed ? 32 : 36;
  const avatar = user?.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- User avatar from Clerk is a dynamic external URL; next/image would require remotePatterns config and offers little benefit for a small avatar.
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
    } else if (k === "unlock") {
      setIsOpen(false);
      // Never subscribed → show the paywall so they can sign up for the first time.
      // Has subscription history (cancelled, paused, past-due) → send to billing
      // settings to renew / update their card.
      if (!subscription || subscription.status === "NONE") {
        void requestPaywall(undefined, { hidePreview: true });
      } else {
        router.push(ROUTES.APP.SETTINGS_BILLING);
        onNavigate?.();
      }
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
            : "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--pv-nav-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
        }
      >
        {content ?? avatar}
      </Popover.Trigger>
      <Popover.Content
        offset={8}
        placement={collapsed ? "right bottom" : "top start"}
      >
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

            {entitled ? null : (
              <ListBox.Item id="unlock" textValue="Unlock access to vault">
                <div className="flex h-8 items-center justify-center">
                  <HugeiconsIcon
                    className="size-4 shrink-0 text-[var(--pv-brand-red,#f12c23)]"
                    icon={SquareUnlock01Icon}
                  />
                </div>
                <div className="flex flex-col">
                  <Label>Unlock access to vault</Label>
                  <Description>Subscribe, upgrade, or update card</Description>
                </div>
              </ListBox.Item>
            )}

            <ListBox.Item id="terms" textValue="Terms and conditions">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-600"
                  icon={LegalDocumentIcon}
                />
              </div>
              <Label>Terms and conditions</Label>
            </ListBox.Item>

            <ListBox.Item id="help" textValue="Help">
              <div className="flex h-8 items-center justify-center">
                <HugeiconsIcon
                  className="size-4 shrink-0 text-default-600"
                  icon={HelpCircleIcon}
                />
              </div>
              <div className="flex flex-col">
                <Label>Help</Label>
                <Description>Account, billing, access</Description>
              </div>
            </ListBox.Item>
          </ListBox>

          {/* Extra top margin + thicker divider isolates the destructive
              Log out action from T&C / Help rows above. QA testers
              reported hitting T&C when going for Log out
              (2026-07-29 item 49). */}
          <ListBox
            aria-label="Session"
            className="border-t-2 border-default-200 px-2 pb-2 pt-2"
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
