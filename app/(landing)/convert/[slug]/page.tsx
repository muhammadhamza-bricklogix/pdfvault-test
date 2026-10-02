import type { Metadata } from "next";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingFreshStart } from "@/components/sections/new-landing/landing-fresh-start";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { LandingSteps } from "@/components/sections/new-landing/landing-steps";
import { LandingTestimonials } from "@/components/sections/new-landing/landing-testimonials";
import { UploadWorkspace } from "@/components/sections/new-landing/upload-workspace";
import { CONVERT_ROUTES } from "@/lib/shared/constants/convert-routes";

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

  return (
    <div id="top">
      <LandingFreshStart />
      <LandingHeader />
      <main>
        <section className="bg-white pb-8 pt-14 sm:pb-10 sm:pt-20">
          <div className="pv-container flex flex-col items-center text-center">
            <h1 className="font-bold leading-[1.05] tracking-[-0.03em] whitespace-nowrap text-[clamp(15px,5.5vw,56px)] text-[#121212]">
              {route.heroTitle ?? route.title}
            </h1>
            <p className="mt-6 max-w-[560px] text-[18px] leading-relaxed font-medium text-[var(--pv-gray-8)]">
              {route.heroSubtitle ?? route.description}
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
