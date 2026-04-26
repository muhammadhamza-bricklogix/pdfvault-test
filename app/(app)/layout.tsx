import type { ReactNode } from "react";

import { DashboardShell } from "@/components/sections/dashboard/dashboard-shell";

type AppLayoutProps = {
    children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
    return <DashboardShell>{children}</DashboardShell>;
}
