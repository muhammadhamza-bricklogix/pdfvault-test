import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { UploadWorkspace } from "@/components/sections/new-landing/upload-workspace";
import { CONVERT_ROUTES } from "@/lib/shared/constants/convert-routes";

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
      <LandingHeader />
      <main>
        <section className="bg-white pb-8 pt-14 sm:pb-10 sm:pt-20">
          <div className="pv-container flex flex-col items-center text-center">
            <Link
              className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-[#5f5f5f] transition-colors hover:text-[var(--pv-brand-red,#f12c23)]"
              href="/"
            >
              <span aria-hidden>←</span> Back to all tools
            </Link>
            <h1 className="pv-display max-w-[820px] text-[#121212]">
              {route.title}
            </h1>
            <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
              {route.description}
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
      </main>
      <LandingFooter />
    </div>
  );
}
