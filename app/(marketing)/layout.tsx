import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shared/footer/site-footer";
import { SiteNavbar } from "@/components/shared/navigation/site-navbar";

type MarketingLayoutProps = {
  children: ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar />
      <main className="mx-auto flex w-full max-w-7xl flex-1 px-6 py-10 sm:px-8 sm:py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
