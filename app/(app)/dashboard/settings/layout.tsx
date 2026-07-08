import type { ReactNode } from "react";

import { SettingsNav } from "@/components/sections/dashboard/settings/settings-nav";

/**
 * Shared settings layout — matches Frame 2043684300 / -1.
 *
 *   1. Page header: "Account Settings" + muted subtitle.
 *   2. Segmented pill nav: General · Account · Language & Region · Danger Zone.
 *   3. Content column, tab-owned.
 *
 * Every tab renders inside the same white main card mounted by
 * `DashboardShell`. A hairline sits between the tab bar and the content.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="pv-heading text-[26px] font-semibold leading-tight text-[var(--pv-text-strong)] sm:text-[28px]">
          Account Settings
        </h1>
        <p className="mt-1 text-[15px] text-[var(--pv-text-body)]">
          You can setup your account, password and billing
        </p>
      </header>

      <SettingsNav />

      <div className="border-t border-[var(--pv-hairline)]">{children}</div>
    </div>
  );
}
