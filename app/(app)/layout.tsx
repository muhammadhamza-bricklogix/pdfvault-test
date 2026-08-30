import type { ReactNode } from "react";

import { ClerkAppShell } from "@/components/shared/clerk-app-shell";
import { DashboardShell } from "@/components/sections/dashboard/dashboard-shell";

type AppLayoutProps = {
  children: ReactNode;
};

/**
 * Wraps the dashboard route-group in Clerk. Previously ClerkProvider lived
 * at the root layout, but every landing / marketing / legal page then had
 * to hydrate `@clerk/clerk-js` too — a ~200 KiB JS cost on routes that
 * never need it. Root layout now ships no Clerk; each authenticated route
 * group brings its own `<ClerkAppShell>` (which wraps ClerkProvider +
 * mounts EmailFirstModal, UserSyncBoot, OfflineBoot, SentryUserContext).
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ClerkAppShell>
      <DashboardShell>{children}</DashboardShell>
    </ClerkAppShell>
  );
}
