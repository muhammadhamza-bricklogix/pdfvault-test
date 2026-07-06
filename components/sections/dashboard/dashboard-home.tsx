"use client";

import {
  ChartBarIncreasingIcon,
  Edit02Icon,
  FileExportIcon,
  Layout03Icon,
  LockKeyIcon,
  PaintBrush01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

import { DocumentsTable } from "./documents-table";
import { PendingConversionBanner } from "./pending-conversion-banner";
import { UploadCta } from "./upload-cta";

/**
 * Tool tiles surfaced at the top of "My files". Each one routes to a real
 * feature already in the app — no AI/translate/OCR/QR placeholders.
 *
 * - Convert PDF / Word to PDF: dedicated conversion landings.
 * - Edit / Annotate / Organize / Protect: editor entry, since the actual
 *   workflows live as modals + tools inside `/pdf-editor`.
 */
const TOOL_TILES: ReadonlyArray<{
  description: string;
  href: string;
  icon: typeof Edit02Icon;
  title: string;
  tone: "indigo" | "rose" | "amber" | "emerald" | "sky" | "violet";
}> = [
  {
    description: "PDF → Word, Excel, image, and more.",
    href: `${ROUTES.PUBLIC.HOME}#pdf-tools`,
    icon: FileExportIcon,
    title: "Convert PDF",
    tone: "rose",
  },
  {
    description: "Word, Excel, PPT, and images to PDF.",
    href: ROUTES.TOOLS.DOC_TO_PDF,
    icon: ChartBarIncreasingIcon,
    title: "Word to PDF",
    tone: "indigo",
  },
  {
    description: "Edit text, draw, highlight, and annotate.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Edit02Icon,
    title: "Edit PDF",
    tone: "amber",
  },
  {
    description: "Sign and watermark with vector strokes.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: PaintBrush01Icon,
    title: "Sign & Watermark",
    tone: "violet",
  },
  {
    description: "Reorder, rotate, split, and merge pages.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Layout03Icon,
    title: "Organize Pages",
    tone: "emerald",
  },
  {
    description: "Add or remove password protection.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: LockKeyIcon,
    title: "Protect PDF",
    tone: "sky",
  },
];

const TONE_STYLES: Record<(typeof TOOL_TILES)[number]["tone"], string> = {
  indigo:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};

export function DashboardHome() {
  return (
    <div className="mx-auto flex w-[95%] max-w-none flex-col gap-6">
      <PendingConversionBanner />
      {/* Top bar — title + upload CTA on the right, search row owned by the
          documents table below. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            My PDFs
          </h1>
          <p className="mt-1 text-sm text-default-500">
            Open, rename, download, or delete your saved PDFs.
          </p>
        </div>
        <UploadCta />
      </div>

      {/* Tool tile row — fast access to the workflows that already exist in
          the editor. Horizontal scroll on narrow viewports, grid on wide. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TOOL_TILES.map((tile) => (
          <Link
            key={tile.title}
            className="group flex items-center gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] px-3 py-3 transition-colors hover:border-[color-mix(in_oklab,var(--color-accent)_50%,transparent)] hover:bg-default-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:border-default-700"
            href={tile.href}
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${TONE_STYLES[tile.tone]}`}
            >
              <HugeiconsIcon icon={tile.icon} size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                {tile.title}
              </p>
              <p className="line-clamp-1 text-xs text-default-500">
                {tile.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <DocumentsTable />
    </div>
  );
}
