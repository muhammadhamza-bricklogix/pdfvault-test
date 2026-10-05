"use client";

import type { ThemeProviderProps } from "next-themes";

import { Toast } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { PaywallProvider } from "@/components/sections/billing/PaywallProvider";
import { AuthModal } from "@/components/shared/auth-modal";
import { DuplicateFilenameModal } from "@/components/shared/duplicate-filename-modal";
import { EmailFirstModal } from "@/components/shared/email-first-modal";
import { LoginToDownloadModal } from "@/components/shared/login-to-download-modal";
import { EditorEventsLogger } from "@/components/shared/editor-events-logger";
import { GoogleAdsClickBoot } from "@/components/shared/google-ads-click-boot";
import { AcquisitionBoot } from "@/components/shared/acquisition-boot";
import { MobileDebugBoot } from "@/components/shared/mobile-debug-boot";
import { LangPrefHonor } from "@/components/shared/navigation/lang-pref-honor";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { OfflineBoot } from "@/components/shared/offline-boot";
import { SentryUserContext } from "@/components/shared/sentry-user-context";
import { UserSyncBoot } from "@/components/shared/user-sync-boot";
import { VisualViewportSync } from "@/components/shared/visual-viewport-sync";
import { UploadToastProvider } from "@/components/ui/upload-toast";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  children: React.ReactNode;
  themeProps?: Omit<ThemeProviderProps, "children">;
};

export function AppProviders({ children, themeProps }: AppProvidersProps) {
  return (
    <NextThemesProvider {...themeProps}>
      <QueryProvider>
        <PaywallProvider>
          <OfflineBanner />
          {children}
          {/*
            `maxVisibleToasts` defaults to 3 with the extras collapsing
            into a single pill — users complained they couldn't read
            back-to-back messages. Bumping to 5 with a slightly larger
            gap gives every toast its own row so a burst of
            notifications is legible.
          */}
          <Toast.Provider gap={12} maxVisibleToasts={5} placement="top end" />
          <UploadToastProvider />
          <AuthModal />
          <DuplicateFilenameModal />
          <EmailFirstModal />
          <LoginToDownloadModal />
          <MobileDebugBoot />
          <GoogleAdsClickBoot />
          <AcquisitionBoot />
          <UserSyncBoot />
          <OfflineBoot />
          <SentryUserContext />
          <EditorEventsLogger />
          <LangPrefHonor />
          <VisualViewportSync />
        </PaywallProvider>
      </QueryProvider>
    </NextThemesProvider>
  );
}
