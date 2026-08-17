"use client";

import type { ThemeProviderProps } from "next-themes";

import { Toast } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Suspense } from "react";

import { PaywallProvider } from "@/components/sections/billing/PaywallProvider";
import { MobileDebugBoot } from "@/components/shared/mobile-debug-boot";
import { WeglotRouteSync } from "@/components/shared/navigation/weglot-route-sync";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { OfflineBoot } from "@/components/shared/offline-boot";
import { SignInPromptModal } from "@/components/shared/sign-in-prompt-modal";
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
          {/*
            `maxVisibleToasts` defaults to 3 with the extras collapsing
            into a single pill — users complained they couldn't read
            back-to-back messages. Bumping to 5 with a slightly larger
            gap gives every toast its own row so a burst of
            notifications is legible.
          */}
          <Toast.Provider gap={12} maxVisibleToasts={5} placement="top end" />
          <UploadToastProvider />
          <SignInPromptModal />
          <MobileDebugBoot />
          <UserSyncBoot />
          <OfflineBoot />
          {/* Re-runs Weglot on every client-side route change so the
              translation applied on `/` carries over when the user
              navigates into `/convert/*`, `/pdf-composer`, etc. Wrapped
              in Suspense because `useSearchParams` needs it during SSR. */}
          <Suspense fallback={null}>
            <WeglotRouteSync />
          </Suspense>
        </PaywallProvider>
      </QueryProvider>
    </NextThemesProvider>
  );
}
