import type { Metadata } from "next";

import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingFreshStart } from "@/components/sections/new-landing/landing-fresh-start";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";
import { LandingTestimonials } from "@/components/sections/new-landing/landing-testimonials";
import { UploadWorkspace } from "@/components/sections/new-landing/upload-workspace";
import { getLandingMessages } from "@/lib/client/i18n/landing-messages";
import { CONVERT_ROUTES } from "@/lib/shared/constants/convert-routes";
import { LOCALE_HEADER } from "@/lib/shared/constants/locale-map";

const LandingTools = dynamic(() =>
  import("@/components/sections/new-landing/landing-tools").then(
    (m) => m.LandingTools,
  ),
);
const LandingBanner = dynamic(() =>
  import("@/components/sections/new-landing/landing-banner").then(
    (m) => m.LandingBanner,
  ),
);
const LandingFAQ = dynamic(() =>
  import("@/components/sections/new-landing/landing-faq").then(
    (m) => m.LandingFAQ,
  ),
);

interface Params {
  slug: string;
}

export function generateStaticParams(): Params[] {
  return Object.keys(CONVERT_ROUTES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = CONVERT_ROUTES[slug];

  if (!route) return { title: "Convert — PDFVault" };

  return {
    title: `${route.title} — PDFVault`,
    description: route.description,
  };
}

export default async function ConvertPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const route = CONVERT_ROUTES[slug];

  if (!route) notFound();

  // Server-side locale resolution via the middleware's locale header.
  // `getTranslations()` would be ergonomic, but next-intl in this
  // project is wired through a `"use client"` provider
  // (`LandingI18nProvider`) with no `getRequestConfig`; calling
  // `getTranslations` from a server component throws at render time
  // and surfaces as a 500 (`/de/convert/word-to-pdf` incident
  // 2026-10-07). Reading messages JSON directly stays within the
  // existing architecture.
  const h = await headers();
  const locale = h.get(LOCALE_HEADER) ?? "en";
  const messages = getLandingMessages(locale) as unknown as {
    convertRoutes?: Record<
      string,
      {
        title?: string;
        description?: string;
        heroTitle?: string;
        heroSubtitle?: string;
      }
    >;
  };
  const convertEntry = messages.convertRoutes?.[slug];
  const heroTitle =
    (route.heroTitle ? convertEntry?.heroTitle : convertEntry?.title) ??
    route.heroTitle ??
    route.title;
  const heroSubtitle =
    (route.heroSubtitle
      ? convertEntry?.heroSubtitle
      : convertEntry?.description) ??
    route.heroSubtitle ??
    route.description;

  return (
    <div id="top">
      <LandingFreshStart />
      <LandingHeader />
      <main>
        <section className="bg-white pb-8 pt-14 sm:pb-10 sm:pt-20">
          <div className="pv-container flex flex-col items-center text-center">
            <h1 className="font-bold leading-[1.05] tracking-[-0.03em] text-balance text-[clamp(15px,5.5vw,56px)] text-[#121212]">
              {heroTitle}
            </h1>
            <p className="mt-6 font-medium leading-relaxed text-balance text-[clamp(15px,2.3vw,20px)] text-[var(--pv-gray-8)]">
              {heroSubtitle}
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="mx-auto w-full max-w-[880px] px-6">
            <UploadWorkspace
              acceptExtensions={route.accept}
              exportFormat={route.exportFormat}
              variant="hero"
            />
          </div>
        </section>
        <LandingSteps />
        <LandingTools />
        <LandingBanner />
        <LandingTestimonials />
        <LandingFAQ />
      </main>
      <LandingFooter />
    </div>
  );
}
