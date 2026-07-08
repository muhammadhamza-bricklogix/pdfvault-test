"use client";

import { useUser } from "@clerk/nextjs";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";

import {
  PvFormRow,
  PvSectionHeading,
} from "@/components/sections/dashboard/settings/pv-settings-primitives";
import { PvTextField } from "@/components/sections/dashboard/settings/pv-text-field";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Account tab — Personal info (email, read-only) + Password change form.
 * Matches Frame 2043684300-1.
 *
 * Password change goes through Clerk's `user.updatePassword` which requires
 * the current password + validates that new === confirm and length ≥ 8 (the
 * design hint). Clerk itself will also reject weak or reused passwords.
 */
export default function AccountSettingsPage() {
  const { user, isLoaded } = useUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoaded) {
    return <p className="py-6 text-sm text-[var(--pv-text-muted)]">Loading…</p>;
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !submitting;

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      await user.updatePassword({ currentPassword, newPassword });
      toast.success({ title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      // Clerk throws structured errors with helpful messages — e.g.
      // "Current password is invalid", "Password is too weak", etc.
      const message =
        (err as { errors?: { longMessage?: string }[] })?.errors?.[0]
          ?.longMessage ??
        (err instanceof Error ? err.message : "Please try again.");

      toast.error({
        title: "Couldn't update password",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <PvSectionHeading
        description="You can setup your account, password and billing"
        title="Personal info"
      />

      <PvFormRow
        last
        required
        description="Change your email under your identity provider."
        label="Email address"
      >
        <PvTextField
          disabled
          leadingIcon={Mail01Icon}
          type="email"
          value={email}
        />
      </PvFormRow>

      <PvSectionHeading
        description="Please enter your current password to change your password."
        title="Password"
      />

      <PvFormRow
        required
        description="This is a hint text to help user."
        label="Current password"
      >
        <PvTextField
          autoComplete="current-password"
          placeholder="••••••••"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </PvFormRow>

      <PvFormRow
        required
        description="This is a hint text to help user."
        label="New password"
      >
        <PvTextField
          autoComplete="new-password"
          hint="Your new password must be more than 8 characters."
          placeholder="••••••••"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </PvFormRow>

      <PvFormRow
        last
        required
        description="This is a hint text to help user."
        label="Confirm new password"
      >
        <PvTextField
          autoComplete="new-password"
          hint={mismatch ? "Passwords don't match." : undefined}
          invalid={mismatch}
          placeholder="••••••••"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <div className="mt-4 flex justify-end">
          <button
            className="inline-flex h-10 items-center rounded-full bg-[var(--pv-brand-red)] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--pv-brand-red-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit}
            type="button"
            onClick={() => void submit()}
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </div>
      </PvFormRow>
    </section>
  );
}
