"use client";

import {
  ArrowRight02Icon,
  Delete02Icon,
  Edit02Icon,
  LayerAddIcon,
  LayoutGridIcon,
  RefreshIcon,
  Scissor01Icon,
  SquareLock02Icon,
  SquareUnlock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useState } from "react";

import { TOOL_ROUTE } from "@/lib/shared/constants/tool-routes";

import { DocPickerModal } from "./doc-picker-modal";

type IconGlyph = typeof Edit02Icon;

interface ToolCardEntry {
  title: string;
  description: string;
  href: string;
  icon: IconGlyph;
}

/**
 * Extract the tool slug from a composer-scoped tile href. Returns null
 * for hrefs that shouldn't route through the doc picker (PDF Composer
 * entry, convert routes). Mirrors the helper in `pv-quick-tool-cards.tsx`.
 */
function extractComposerToolSlug(href: string): string | null {
  if (!href.startsWith("/pdf-composer")) return null;
  const qIdx = href.indexOf("?");

  if (qIdx < 0) return null;
  const params = new URLSearchParams(href.slice(qIdx + 1));
  const tool = params.get("tool");

  return tool && tool !== "editor" ? tool : null;
}

const TOOL_CARDS: readonly ToolCardEntry[] = [
  {
    title: "PDF Composer",
    description:
      "Revise text and objects inline with our full in-browser PDF composer.",
    href: TOOL_ROUTE.editor,
    icon: Edit02Icon,
  },
  {
    title: "Compress Document",
    description: "Reduce PDF file size with upto 3 compression levels.",
    href: TOOL_ROUTE.compress,
    icon: LayerAddIcon,
  },
  {
    title: "Organize Pages",
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: TOOL_ROUTE.managePages,
    icon: LayoutGridIcon,
  },
  {
    title: "Split & Extract Pages",
    description:
      "Pull out the pages you need or split a long file into lighter ones.",
    href: TOOL_ROUTE.split,
    icon: Scissor01Icon,
  },
  {
    title: "Password Protect",
    description:
      "Lock your PDF with a password so only intended readers get in.",
    href: TOOL_ROUTE.password,
    icon: SquareLock02Icon,
  },
  {
    title: "Unlock PDF",
    description: "Remove encryption when you have the right credentials.",
    href: TOOL_ROUTE.unlock,
    icon: SquareUnlock01Icon,
  },
  {
    title: "Rotate Pages",
    description: "Fix upside-down scans or mixed-orientation bundles.",
    href: TOOL_ROUTE.managePages,
    icon: RefreshIcon,
  },
  {
    title: "Delete Pages",
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: TOOL_ROUTE.managePages,
    icon: Delete02Icon,
  },
];

// `h-full` on the card + `h-full` on each grid `<li>` makes every card
// stretch to the tallest sibling in its row — so a 1-line description and
// a 2-line description read as equal-height tiles. QA 2026-08-20.
const TOOL_CARD_CLASSNAME =
  "group flex h-full w-full flex-col gap-4 rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] p-5 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2";

function ToolCardContent({ tool }: { tool: ToolCardEntry }) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-[12px] bg-[var(--pv-tile)] text-[var(--pv-text-strong)]"
      >
        <HugeiconsIcon icon={tool.icon} size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="pv-heading text-[17px] font-semibold leading-snug text-[var(--pv-text-strong)]">
          {tool.title}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--pv-text-body)]">
          {tool.description}
        </p>
      </div>
      <span
        aria-hidden
        // `mt-auto` pins the arrow to the card bottom, so the row of
        // arrows lines up across siblings even when descriptions differ
        // in length. Pairs with `h-full` on the card / `<li>`.
        className="mt-auto inline-flex text-[var(--pv-text-strong)] transition-transform group-hover:translate-x-0.5"
      >
        <HugeiconsIcon icon={ArrowRight02Icon} size={18} />
      </span>
    </>
  );
}

function ToolCard({
  tool,
  onOpenPicker,
}: {
  tool: ToolCardEntry;
  onOpenPicker: (slug: string, label: string) => void;
}) {
  const pickerSlug = extractComposerToolSlug(tool.href);

  if (pickerSlug) {
    return (
      <button
        className={TOOL_CARD_CLASSNAME}
        type="button"
        onClick={() => onOpenPicker(pickerSlug, tool.title)}
      >
        <ToolCardContent tool={tool} />
      </button>
    );
  }

  return (
    <Link className={TOOL_CARD_CLASSNAME} href={tool.href}>
      <ToolCardContent tool={tool} />
    </Link>
  );
}

export function PvToolsGrid() {
  const [picker, setPicker] = useState<{
    slug: string;
    label: string;
  } | null>(null);

  return (
    <>
      <section aria-label="PDF tools">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOL_CARDS.map((tool) => (
            <li key={tool.title} className="h-full">
              <ToolCard
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
