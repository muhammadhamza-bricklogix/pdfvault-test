"use client";

import type { ReactNode } from "react";

import { ClerkProvider } from "@clerk/nextjs";

import { PaywallProvider } from "@/components/sections/billing/PaywallProvider";
import { EmailFirstModal } from "@/components/shared/email-first-modal";
import { OfflineBoot } from "@/components/shared/offline-boot";
import { SentryUserContext } from "@/components/shared/sentry-user-context";
import { UserSyncBoot } from "@/components/shared/user-sync-boot";

/**
 * Wraps an authenticated route subtree in `<ClerkProvider>` and mounts
 * every Clerk-dependent global that used to live at the root layout —
 * `EmailFirstModal`, `UserSyncBoot`, `OfflineBoot`, `SentryUserContext`.
 *
 * Moved out of root `AppProviders` on 2026-08-30 so landing / marketing /
 * legal routes stop shipping the Clerk JS SDK. Every layout that DOES
 * expect a signed-in user (dashboard, tools, auth flows) wraps its
 * subtree in this shell instead of relying on a root-level provider.
 *
 * Config props mirror the previous root-layout `<ClerkProvider>` so the
 * post-signin redirect flow (auth-chain items #15, #16) behaves
 * identically regardless of which shell instance handled the session.
 *
 * Nested-provider note: `LazyAuthModalHost` (still mounted at root via
 * `AppProviders`) also wraps its dynamically-imported modal in its own
 * `<ClerkProvider>`. On routes where this shell is present, the modal's
 * inner provider nests inside this one — Clerk handles nested providers
 * (innermost wins for `useAuth`) and both share the same `__session`
 * cookie, so state stays coherent.
 */
export function ClerkAppShell({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/dashboard"
      signUpUrl="/sign-up"
    >
      <PaywallProvider>
        {children}
        <EmailFirstModal />
        <UserSyncBoot />
        <OfflineBoot />
        <SentryUserContext />
      </PaywallProvider>
    </ClerkProvider>
  );
}
