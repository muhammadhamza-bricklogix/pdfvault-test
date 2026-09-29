import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shared/footer/site-footer";
import { SiteNavbar } from "@/components/shared/navigation/site-navbar";
import { LandingI18nProvider } from "@/lib/client/i18n/landing-i18n-provider";

/** Avoid stale HTML for the marketing shell (navbar/footer) behind CDNs or aggressive caching. */
export const dynamic = "force-dynamic";

type MarketingLayoutProps = {
  children: ReactNode;
};

// `LandingI18nProvider` wraps the whole marketing shell so `LandingFooter`
// (rendered by SiteFooter below) and any child route calling
// `useTranslations` resolves against the same provider. Without this the
// entire (marketing) subtree 500s at SSR because next-intl re-throws an
// empty Error when the hook can't find its context.
export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <LandingI18nProvider>
      <div className="flex min-h-screen flex-col">
        <SiteNavbar />
        <main className="flex w-full flex-1 flex-col">{children}</main>
        <SiteFooter />
      </div>
    </LandingI18nProvider>
  );
}
