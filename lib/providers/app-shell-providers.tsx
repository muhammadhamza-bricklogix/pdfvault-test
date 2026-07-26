"use client";

import { PaywallProvider } from "@/components/sections/billing/PaywallProvider";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { OfflineBoot } from "@/components/shared/offline-boot";
import { SignInPromptModal } from "@/components/shared/sign-in-prompt-modal";
import { UserSyncBoot } from "@/components/shared/user-sync-boot";
import { UploadToastProvider } from "@/components/ui/upload-toast";

type AppShellProvidersProps = {
  children: React.ReactNode;
};

/**
 * Providers that only belong inside authenticated app shells (dashboard,
 * settings, PDF editor). Keeping them out of the root layout prevents
 * marketing/landing pages from paying their bundle and initialization cost.
 */
export function AppShellProviders({ children }: AppShellProvidersProps) {
  return (
    <PaywallProvider>
      <OfflineBanner />
      {children}
      <UploadToastProvider />
      <SignInPromptModal />
      <UserSyncBoot />
      <OfflineBoot />
    </PaywallProvider>
  );
}
