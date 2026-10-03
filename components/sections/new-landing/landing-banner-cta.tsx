"use client";

import type { ReactNode } from "react";

import { Show } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

import { ROUTES } from "@/lib/shared/constants/routes";

import { localizeHref, useRouteLocale } from "./locale-nav-link";

const CTA_CLASS =
  "notranslate wg-notranslate mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-gray-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// Clerk renders these after Weglot's first pass, so the copy comes from next-intl.
export function LandingBannerCta({ icon }: { icon: ReactNode }) {
  const t = useTranslations("banner");
  const routeLocale = useRouteLocale();

  return (
    <>
      <Show when="signed-out">
        <a
          className={CTA_CLASS}
          href={localizeHref(ROUTES.AUTH.SIGN_UP, routeLocale)}
          translate="no"
        >
          {t("createVault")}
          {icon}
        </a>
      </Show>
      <Show when="signed-in">
        <a
          className={CTA_CLASS}
          href={localizeHref(ROUTES.APP.DASHBOARD, routeLocale)}
          translate="no"
        >
          {t("managePdfs")}
          {icon}
        </a>
      </Show>
    </>
  );
}
