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

type IconGlyph = typeof Edit02Icon;

interface ToolCardEntry {
  title: string;
  description: string;
  href: string;
  icon: IconGlyph;
}

const TOOL_CARDS: readonly ToolCardEntry[] = [
  {
    title: "PDF Composer",
    description:
      "Revise text and objects inline with our full in-browser PDF composer.",
    href: "/pdf-composer",
    icon: Edit02Icon,
  },
  {
    title: "Compress Document",
    description: "Reduce PDF file size with upto 3 compression levels.",
    href: "/pdf-composer",
    icon: LayerAddIcon,
  },
  {
    title: "Organize Pages",
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: "/pdf-composer",
    icon: LayoutGridIcon,
  },
  {
    title: "Split & Extract Pages",
    description:
      "Pull out the pages you need or split a long file into lighter ones.",
    href: "/pdf-composer",
    icon: Scissor01Icon,
  },
  {
    title: "Password Protect",
    description:
      "Lock your PDF with a password so only intended readers get in.",
    href: "/pdf-composer",
    icon: SquareLock02Icon,
  },
  {
    title: "Unlock PDF",
    description: "Remove encryption when you have the right credentials.",
    href: "/pdf-composer",
    icon: SquareUnlock01Icon,
  },
  {
    title: "Rotate Pages",
    description: "Fix upside-down scans or mixed-orientation bundles.",
    href: "/pdf-composer",
    icon: RefreshIcon,
  },
  {
    title: "Delete Pages",
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: "/pdf-composer",
    icon: Delete02Icon,
  },
];

function ToolCard({ tool }: { tool: ToolCardEntry }) {
  return (
    <Link
      className="group flex flex-col gap-4 rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] p-5 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2"
      href={tool.href}
    >
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
        className="mt-1 inline-flex text-[var(--pv-text-strong)] transition-transform group-hover:translate-x-0.5"
      >
        <HugeiconsIcon icon={ArrowRight02Icon} size={18} />
      </span>
    </Link>
  );
}

export function PvToolsGrid() {
  return (
    <section aria-label="PDF tools">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOL_CARDS.map((tool) => (
          <li key={tool.title}>
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
    </section>
  );
}
