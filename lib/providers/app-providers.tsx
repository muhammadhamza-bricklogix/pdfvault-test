"use client";

import type { ThemeProviderProps } from "next-themes";

import { Toast } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { MobileDebugBoot } from "@/components/shared/mobile-debug-boot";
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
        {children}
        <Toast.Provider placement="top end" />
        <UploadToastProvider />
        <MobileDebugBoot />
      </QueryProvider>
    </NextThemesProvider>
  );
}
