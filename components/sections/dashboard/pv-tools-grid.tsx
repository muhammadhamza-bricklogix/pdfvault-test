"use client";

import {
  ArrowRight02Icon,
  Delete02Icon,
  Edit02Icon,
  File01Icon,
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

import { FormsModal } from "@/components/shared/forms-modal";
import { TOOL_ROUTE } from "@/lib/shared/constants/tool-routes";

type IconGlyph = typeof Edit02Icon;

interface ToolCardEntry {
  title: string;
  description: string;
  href: string;
  icon: IconGlyph;
  action?: "forms";
}

// Composer tiles route straight into `/pdf-composer?tool=<slug>` via
// `TOOL_ROUTE.*` — one upload screen for the whole app (QA 2026-08-27).
// The composer's own `<UploadScreen />` handles the drop and the hydrator
// auto-launches the matching modal / tool once the file lands.
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
  {
    title: "Forms",
    description:
      "Fill IRS forms like W-9 online. Type, sign, and export a clean PDF.",
    href: "#forms",
    icon: File01Icon,
    action: "forms",
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
  onOpenForms,
}: {
  tool: ToolCardEntry;
  onOpenForms: () => void;
}) {
  if (tool.action === "forms") {
    return (
      <button
        className={TOOL_CARD_CLASSNAME}
        type="button"
        onClick={onOpenForms}
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
  const [formsOpen, setFormsOpen] = useState(false);

  return (
    <>
      <section aria-label="PDF tools">
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TOOL_CARDS.map((tool) => (
            <li key={tool.title} className="h-full">
              <ToolCard tool={tool} onOpenForms={() => setFormsOpen(true)} />
            </li>
          ))}
        </ul>
      </section>
      <FormsModal isOpen={formsOpen} onOpenChange={setFormsOpen} />
    </>
  );
}
