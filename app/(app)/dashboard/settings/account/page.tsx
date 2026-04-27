"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          Account
        </h2>
        <p className="text-sm text-[var(--app-muted)]">
          Manage your email, password, connected accounts, and active sessions.
        </p>
      </header>

      <UserProfile
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full shadow-none border border-[var(--app-border)]",
          },
        }}
        routing="hash"
      />
    </div>
  );
}
