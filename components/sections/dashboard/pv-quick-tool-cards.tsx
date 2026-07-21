"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { TOOL_ROUTE } from "@/lib/shared/constants/tool-routes";

import { DocPickerModal } from "./doc-picker-modal";

interface QuickTool {
  title: string;
  description: string;
  href: string;
  /** Public path to the illustration SVG. */
  illustrationSrc: string;
}

/**
 * If the tile's href is `/pdf-composer?tool=<slug>`, return the slug
 * so we can open the doc-picker modal instead of navigating to an
 * empty composer. Composer entry (`?tool=` absent) and convert routes
 * stay as plain Links.
 */
function extractComposerToolSlug(href: string): string | null {
  if (!href.startsWith("/pdf-composer")) return null;
  const qIdx = href.indexOf("?");

  if (qIdx < 0) return null;
  const params = new URLSearchParams(href.slice(qIdx + 1));
  const tool = params.get("tool");

  return tool && tool !== "editor" ? tool : null;
}

/**
 * The six "quick tools" gallery on the My PDFs page (Figma frames 1 & 3).
 * Each card is left-aligned title + one-line description on the left, and a
 * decorative illustration on the right. Cards are `--pv-surface` with a
 * hairline border, ~16px radius, flat by default with a soft hover lift.
 *
 * Illustrations come from `public/Dashboard/Dashboard_Illustrations/` — the
 * SVG variants Figma exported alongside PNG @2x fallbacks. SVG stays crisp
 * at any DPR, so we point `next/image` at those and pass explicit width /
 * height so the browser reserves layout space and avoids CLS.
 */
const ILLUSTRATIONS_BASE = "/Dashboard/Dashboard_Illustrations";

// Illustrations are landscape ~600×340 in the SVG source. Rendered at 148×84
// on the card so they hit ~24% of the card width on desktop without
// crowding the copy. Height is what enforces the layout; `next/image` scales
// preserving aspect.
const ILLUSTRATION_WIDTH = 148;
const ILLUSTRATION_HEIGHT = 84;

const QUICK_TOOLS: readonly QuickTool[] = [
  {
    title: "PDF to Word",
    description: "PDF → Word, Excel, image, and more.",
    href: "/convert/pdf-to-word",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Convert%20PDF.svg`,
  },
  {
    title: "Word to PDF",
    description: "Word, Excel, PPT, and images to PDF.",
    href: "/convert/word-to-pdf",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Word%20to%20PDF.svg`,
  },
  {
    title: "Edit PDF",
    description: "Edit text, draw, highlight, and annotate.",
    href: TOOL_ROUTE.editor,
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Edit%20PDF.svg`,
  },
  {
    title: "Sign & Watermark",
    description: "Sign and watermark with vector strokes.",
    href: TOOL_ROUTE.watermark,
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Sign%20%26%20Watermark.svg`,
  },
  {
    title: "Organize Pages",
    description: "Reorder, rotate, split, and merge pages.",
    href: TOOL_ROUTE.managePages,
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Organize%20Pages.svg`,
  },
  {
    title: "Protect PDF",
    description: "Add or remove password protection.",
    href: TOOL_ROUTE.password,
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Protect%20PDF.svg`,
  },
];

const CARD_CLASSNAME =
  "group flex w-full items-center justify-between gap-4 overflow-hidden rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-5 py-4 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2";

function CardContent({ tool }: { tool: QuickTool }) {
  return (
    <>
      <div className="min-w-0">
        <p className="pv-heading text-[16px] font-semibold leading-snug text-[var(--pv-text-strong)]">
          {tool.title}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--pv-text-body)]">
          {tool.description}
        </p>
      </div>
      <span className="shrink-0">
        <Image
          alt=""
          className="h-[84px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          height={ILLUSTRATION_HEIGHT}
          src={tool.illustrationSrc}
          width={ILLUSTRATION_WIDTH}
        />
      </span>
    </>
  );
}

function QuickToolCard({
  tool,
  onOpenPicker,
}: {
  tool: QuickTool;
  onOpenPicker: (slug: string, label: string) => void;
}) {
  const pickerSlug = extractComposerToolSlug(tool.href);

  if (pickerSlug) {
    return (
      <button
        className={CARD_CLASSNAME}
        type="button"
        onClick={() => onOpenPicker(pickerSlug, tool.title)}
      >
        <CardContent tool={tool} />
      </button>
    );
  }

  return (
    <Link className={CARD_CLASSNAME} href={tool.href}>
      <CardContent tool={tool} />
    </Link>
  );
}

export function PvQuickToolCards() {
  const [picker, setPicker] = useState<{
    slug: string;
    label: string;
  } | null>(null);

  return (
    <>
      <section aria-label="Quick tools">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_TOOLS.map((tool) => (
            <li key={tool.title}>
              <QuickToolCard
                tool={tool}
                onOpenPicker={(slug, label) => setPicker({ slug, label })}
              />
            </li>
          ))}
        </ul>
      </section>
      <DocPickerModal
        isOpen={picker !== null}
        toolLabel={picker?.label ?? null}
        toolSlug={picker?.slug ?? null}
        onClose={() => setPicker(null)}
      />
    </>
  );
}
