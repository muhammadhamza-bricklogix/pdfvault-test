import Image from "next/image";
import Link from "next/link";

interface QuickTool {
  title: string;
  description: string;
  href: string;
  /** Public path to the illustration SVG. */
  illustrationSrc: string;
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
    title: "Convert PDF",
    description: "PDF → Word, Excel, image, and more.",
    href: "/dashboard/tools",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Convert%20PDF.svg`,
  },
  {
    title: "Word to PDF",
    description: "Word, Excel, PPT, and images to PDF.",
    href: "/dashboard/tools",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Word%20to%20PDF.svg`,
  },
  {
    title: "Edit PDF",
    description: "Edit text, draw, highlight, and annotate.",
    href: "/pdf-composer",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Edit%20PDF.svg`,
  },
  {
    title: "Sign & Watermark",
    description: "Sign and watermark with vector strokes.",
    href: "/pdf-composer",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Sign%20%26%20Watermark.svg`,
  },
  {
    title: "Organize Pages",
    description: "Reorder, rotate, split, and merge pages.",
    href: "/pdf-composer",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Organize%20Pages.svg`,
  },
  {
    title: "Protect PDF",
    description: "Add or remove password protection.",
    href: "/pdf-composer",
    illustrationSrc: `${ILLUSTRATIONS_BASE}/Protect%20PDF.svg`,
  },
];

function QuickToolCard({ tool }: { tool: QuickTool }) {
  return (
    <Link
      className="group flex items-center justify-between gap-4 overflow-hidden rounded-[16px] border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-5 py-4 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--pv-hairline-strong)] hover:shadow-[0_10px_24px_-18px_rgba(23,23,23,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2"
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
      <span className="shrink-0">
        <Image
          alt=""
          className="h-[84px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          height={ILLUSTRATION_HEIGHT}
          src={tool.illustrationSrc}
          width={ILLUSTRATION_WIDTH}
        />
      </span>
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
