import type { ReactNode } from "react";

import Link from "next/link";

interface QuickTool {
  title: string;
  description: string;
  href: string;
  illustration: ReactNode;
}

/**
 * The six "quick tools" gallery on the My PDFs page (Figma frame 1 & 3).
 * Each card is left-aligned title + one-line description on the left, and a
 * decorative illustration on the right. Cards are `--pv-surface` with a
 * hairline border, ~16px radius, flat by default with a soft hover lift.
 *
 * Illustrations are inline SVG stubs approximating the Figma export — swap
 * for exported PNG/SVG assets from `public/Dashboard/` when available.
 */
const RED = "var(--pv-brand-red)";
const PDF_COLOR = "var(--pv-file-pdf)";
const DOC_COLOR = "var(--pv-file-doc)";
const PPT_COLOR = "var(--pv-file-ppt)";

function DocPreview({
  color,
  label,
  className = "",
}: {
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex h-14 w-11 flex-col overflow-hidden rounded-[6px] border border-[var(--pv-hairline)] bg-white shadow-sm ${className}`}
    >
      <span className="absolute inset-x-1 top-2 h-1 rounded bg-[var(--pv-hairline)]" />
      <span className="absolute inset-x-1 top-4 h-1 rounded bg-[var(--pv-hairline)]" />
      <span className="absolute inset-x-1 top-6 h-1 rounded bg-[var(--pv-hairline)]" />
      <span
        className="absolute bottom-1 left-1 rounded-[3px] px-1 text-[8px] font-bold uppercase text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    </span>
  );
}

function ArrowChip() {
  return (
    <span
      aria-hidden
      className="flex size-6 items-center justify-center rounded-full text-white shadow-sm"
      style={{ backgroundColor: RED }}
    >
      <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
        <path
          d="M2 6h8m0 0L7 3m3 3-3 3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}

function ConvertPdfArt() {
  return (
    <span className="flex items-center gap-1">
      <DocPreview color={PDF_COLOR} label="PDF" />
      <ArrowChip />
      <DocPreview color={DOC_COLOR} label="DOC" />
    </span>
  );
}

function WordToPdfArt() {
  return (
    <span className="flex items-center gap-1">
      <DocPreview color={DOC_COLOR} label="W" />
      <ArrowChip />
      <DocPreview color={PDF_COLOR} label="PDF" />
    </span>
  );
}

function EditPdfArt() {
  const swatches = [
    "#171717",
    "#FB3748",
    "#FA7319",
    "#FAC22B",
    "#1FC16B",
    "#335CFF",
  ];

  return (
    <span className="flex flex-col items-end gap-1 rounded-[10px] border border-[var(--pv-hairline)] bg-white p-2">
      <span className="flex items-center gap-1">
        <span className="h-2 w-4 rounded-sm bg-[var(--pv-hairline)]" />
        <span className="h-2 w-3 rounded-sm bg-[var(--pv-hairline)]" />
        <span className="h-2 w-2 rounded-sm bg-[var(--pv-hairline)]" />
      </span>
      <span className="flex items-center gap-1">
        {swatches.map((c) => (
          <span
            key={c}
            className="size-2.5 rounded-full"
            style={{ backgroundColor: c }}
          />
        ))}
      </span>
    </span>
  );
}

function SignArt() {
  return (
    <span className="relative">
      <DocPreview className="h-16 w-12" color={PDF_COLOR} label="PDF" />
      <svg
        aria-hidden
        className="absolute -bottom-1 -left-2 text-[var(--pv-brand-red)]"
        fill="none"
        height="18"
        viewBox="0 0 40 18"
        width="40"
      >
        <path
          d="M2 12c4-6 8 3 12-3s6 8 10 2 6 3 14-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
      <span className="absolute -right-1 top-2 flex flex-col items-center gap-0.5">
        <span className="size-1.5 rounded-full bg-[var(--pv-file-pdf)]" />
        <span className="size-1.5 rounded-full bg-[var(--pv-file-doc)]" />
        <span className="size-1.5 rounded-full bg-[var(--pv-file-xls)]" />
      </span>
    </span>
  );
}

function OrganizeArt() {
  return (
    <span className="relative flex">
      <DocPreview
        className="h-14 w-11 -rotate-6"
        color={PDF_COLOR}
        label="PDF"
      />
      <DocPreview
        className="-ml-4 h-14 w-11 rotate-6"
        color={PPT_COLOR}
        label="PPT"
      />
      <span
        aria-hidden
        className="absolute -right-2 -top-1 flex size-6 items-center justify-center rounded-full text-white shadow-sm"
        style={{ backgroundColor: RED }}
      >
        <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
          <path
            d="M3 4l2-2v3h4m0 3l-2 2v-3H3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </span>
    </span>
  );
}

function ProtectArt() {
  return (
    <span className="relative">
      <DocPreview className="h-16 w-12" color={PDF_COLOR} label="PDF" />
      <span
        aria-hidden
        className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-[8px] text-white shadow-sm"
        style={{ backgroundColor: RED }}
      >
        <svg fill="none" height="14" viewBox="0 0 14 14" width="14">
          <path
            d="M7 1l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V3l5-2z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
          <path d="M5 7h4v3H5z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

const QUICK_TOOLS: readonly QuickTool[] = [
  {
    title: "Convert PDF",
    description: "PDF → Word, Excel, image, and more.",
    href: "/dashboard/tools",
    illustration: <ConvertPdfArt />,
  },
  {
    title: "Word to PDF",
    description: "Word, Excel, PPT, and images to PDF.",
    href: "/dashboard/tools",
    illustration: <WordToPdfArt />,
  },
  {
    title: "Edit PDF",
    description: "Edit text, draw, highlight, and annotate.",
    href: "/pdf-editor",
    illustration: <EditPdfArt />,
  },
  {
    title: "Sign & Watermark",
    description: "Sign and watermark with vector strokes.",
    href: "/pdf-editor",
    illustration: <SignArt />,
  },
  {
    title: "Organize Pages",
    description: "Reorder, rotate, split, and merge pages.",
    href: "/pdf-editor",
    illustration: <OrganizeArt />,
  },
  {
    title: "Protect PDF",
    description: "Add or remove password protection.",
    href: "/pdf-editor",
    illustration: <ProtectArt />,
  },
];

function QuickToolCard({ tool }: { tool: QuickTool }) {
  return (
    <Link
      className="group flex items-center justify-between gap-4 rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-5 py-4 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2"
      href={tool.href}
    >
      <div className="min-w-0">
        <p className="pv-heading text-[16px] font-semibold leading-snug text-[var(--pv-text-strong)]">
          {tool.title}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--pv-text-body)]">
          {tool.description}
        </p>
      </div>
      <span className="shrink-0">{tool.illustration}</span>
    </Link>
  );
}

export function PvQuickToolCards() {
  return (
    <section aria-label="Quick tools">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_TOOLS.map((tool) => (
          <li key={tool.title}>
            <QuickToolCard tool={tool} />
          </li>
        ))}
      </ul>
    </section>
  );
}
