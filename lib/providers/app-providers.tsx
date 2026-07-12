"use client";

import type { ThemeProviderProps } from "next-themes";

import { Toast } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { PaywallProvider } from "@/components/sections/billing/PaywallProvider";
import { MobileDebugBoot } from "@/components/shared/mobile-debug-boot";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { OfflineBoot } from "@/components/shared/offline-boot";
import { UserSyncBoot } from "@/components/shared/user-sync-boot";
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
          <Toast.Provider placement="top end" />
          <UploadToastProvider />
          <MobileDebugBoot />
          <UserSyncBoot />
          <OfflineBoot />
        </PaywallProvider>
      </QueryProvider>
    </NextThemesProvider>
  );
}
