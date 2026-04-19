"use client";

import type { ThemeProviderProps } from "next-themes";

import { ThemeProvider as NextThemesProvider } from "next-themes";

import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  children: React.ReactNode;
  themeProps?: Omit<ThemeProviderProps, "children">;
};

export function AppProviders({ children, themeProps }: AppProvidersProps) {
  return (
    <NextThemesProvider {...themeProps}>
      <QueryProvider>{children}</QueryProvider>
    </NextThemesProvider>
  );
}
