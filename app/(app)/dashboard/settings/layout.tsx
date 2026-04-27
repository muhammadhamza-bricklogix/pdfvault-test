import type { ReactNode } from "react";

import { SettingsNav } from "@/components/sections/dashboard/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-6 -my-6 flex h-[calc(100%+3rem)] flex-col sm:-mx-8 lg:flex-row">
      {/* Desktop vertical rail */}
      <aside className="hidden shrink-0 bg-[var(--app-background)]/35 lg:block lg:w-64">
        <div className="sticky top-0 max-h-screen overflow-y-auto px-4 py-6">
          <SettingsNav orientation="vertical" />
        </div>
      </aside>

      {/* Mobile horizontal rail */}
      <div className="shrink-0 overflow-x-auto bg-[var(--app-surface)]/35 px-4 lg:hidden">
        <SettingsNav orientation="horizontal" />
      </div>

      {/* Content column */}
      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
