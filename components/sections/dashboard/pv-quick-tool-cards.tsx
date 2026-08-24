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
    // PRD §6 — lands directly in the edit-text tool, not the generic
    // composer with no tool selected.
    href: TOOL_ROUTE.edit,
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Edit%20PDF.svg`,
  },
  {
    title: "Sign & Watermark",
    description: "Sign and watermark with vector strokes.",
    // PRD §6 — signature tool is the default entry (watermark still
    // reachable one tap away in the toolbar).
    href: TOOL_ROUTE.sign,
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

// Mobile: vertical stack (icon top-right, title + description below) so
// two cards fit per row without the 148 px illustration overflowing.
// Desktop (sm+): back to the horizontal figma layout.
const CARD_CLASSNAME =
  "group flex h-full w-full flex-col items-start gap-3 overflow-hidden rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-4 py-4 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5";

function CardContent({ tool }: { tool: QuickTool }) {
  return (
    <>
      <div className="min-w-0">
        <p className="pv-heading text-[15px] font-semibold leading-snug text-[var(--pv-text-strong)] sm:text-[16px]">
          {tool.title}
        </p>
        <p className="mt-1 hidden text-[12px] leading-snug text-[var(--pv-text-body)] sm:block sm:text-[13px]">
          {tool.description}
        </p>
      </div>
      <span className="shrink-0 self-end sm:self-auto">
        <Image
          alt=""
          className="h-[56px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03] sm:h-[84px]"
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

// Mobile initial-view cap. Reviewers reported the six-card single column
// stretched the fold on small phones; showing four then a "View more"
// toggle keeps the fold tight without hiding the tools behind a route.
const MOBILE_INITIAL_COUNT = 4;

export function PvQuickToolCards() {
  const [picker, setPicker] = useState<{
    slug: string;
    label: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hiddenOnMobile = QUICK_TOOLS.length - MOBILE_INITIAL_COUNT;
  const showViewMore = hiddenOnMobile > 0 && !expanded;

  return (
    <>
      <section aria-label="Quick tools" data-tour="dashboard-quick-tools">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {QUICK_TOOLS.map((tool, index) => {
            const hideOnMobile = !expanded && index >= MOBILE_INITIAL_COUNT;

            return (
              <li
                key={tool.title}
                className={hideOnMobile ? "hidden sm:block" : undefined}
              >
                <QuickToolCard
                  tool={tool}
                  onOpenPicker={(slug, label) => setPicker({ slug, label })}
                />
              </li>
            );
          })}
        </ul>
        {showViewMore ? (
          <div className="mt-3 sm:hidden">
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-4 text-[13px] font-semibold text-[var(--pv-text-strong)] transition-colors hover:border-[var(--pv-hairline-strong)] hover:bg-[var(--pv-nav-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
              type="button"
              onClick={() => setExpanded(true)}
            >
              View more
              <span className="text-[var(--pv-text-muted)]">
                (+{hiddenOnMobile})
              </span>
            </button>
          </div>
        ) : null}
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
