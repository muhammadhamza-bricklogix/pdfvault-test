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
      <main className="flex w-full flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
