"use client";

import type { ThemeProviderProps } from "next-themes";

import { AppProviders } from "@/lib/providers/app-providers";

type ProvidersProps = {
  children: React.ReactNode;
  themeProps?: Omit<ThemeProviderProps, "children">;
};

export function Providers({ children, themeProps }: ProvidersProps) {
  return <AppProviders themeProps={themeProps}>{children}</AppProviders>;
}
