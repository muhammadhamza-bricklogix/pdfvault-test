"use client";

import type { ThemeProviderProps } from "next-themes";

import { Toast } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Suspense } from "react";

import { EditorEventsLogger } from "@/components/shared/editor-events-logger";
import { GoogleAdsClickBoot } from "@/components/shared/google-ads-click-boot";
import { LazyAuthModalHost } from "@/components/shared/lazy-auth-modal-host";
import { MobileDebugBoot } from "@/components/shared/mobile-debug-boot";
import { WeglotRouteSync } from "@/components/shared/navigation/weglot-route-sync";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
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
        {/* PaywallProvider was mounted here (root) — it transitively pulls
            `useUser()` via `useEntitlementAllowlist`, which crashes on
            landing without ClerkProvider. Moved 2026-08-30 into
            `<ClerkAppShell>` inside every authenticated route-group
            layout, where the paywall modal is actually needed. */}
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
        {/* AuthModal + Clerk-dependent globals were previously mounted
              here (root). Moved 2026-08-30 so landing / marketing / legal
              routes stop shipping the Clerk SDK on their initial bundle:
                - `LazyAuthModalHost` mounts null until first `app:auth-modal`
                  event, then dynamic-imports `StandaloneAuthModal` (which
                  brings its own <ClerkProvider>).
                - `EmailFirstModal`, `UserSyncBoot`, `OfflineBoot`, and
                  `SentryUserContext` moved into `<ClerkAppShell>` inside
                  every authenticated route-group layout (`(app)`,
                  `(tools)`, `(marketing)/(site)/(auth)`). */}
        <LazyAuthModalHost />
        <MobileDebugBoot />
        <GoogleAdsClickBoot />
        <EditorEventsLogger />
        {/* Re-runs Weglot on every client-side route change so the
              translation applied on `/` carries over when the user
              navigates into `/convert/*`, `/pdf-composer`, etc. Wrapped
              in Suspense because `useSearchParams` needs it during SSR. */}
        <Suspense fallback={null}>
          <WeglotRouteSync />
        </Suspense>
      </QueryProvider>
    </NextThemesProvider>
  );
}
