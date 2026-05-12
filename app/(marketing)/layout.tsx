import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shared/footer/site-footer";
import { SiteNavbar } from "@/components/shared/navigation/site-navbar";

/** Avoid stale HTML for the marketing shell (navbar/footer) behind CDNs or aggressive caching. */
export const dynamic = "force-dynamic";

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
