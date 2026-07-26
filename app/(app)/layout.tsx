import type { ReactNode } from "react";

import { DashboardShell } from "@/components/sections/dashboard/dashboard-shell";
import { AppShellProviders } from "@/lib/providers/app-shell-providers";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppShellProviders>
      <DashboardShell>{children}</DashboardShell>
    </AppShellProviders>
  );
}
