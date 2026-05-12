import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { ToolUploadSection } from "@/components/sections/tools/tool-upload-section";
import { TOOLS } from "@/lib/shared/constants/tools";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(TOOLS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOLS[slug];

  if (!tool) {
    return { title: "Tool" };
  }

  return {
    description: tool.description,
    title: tool.title,
  };
}

export default async function ToolBySlugPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = TOOLS[slug];

  if (!tool) {
    notFound();
  }

  return <ToolUploadSection tool={tool} />;
}
