import {
  AiScanIcon,
  ArchiveIcon,
  ArrowRight01Icon,
  CropIcon,
  Delete02Icon,
  FileExportIcon,
  FileUnlockedIcon,
  GroupLayersIcon,
  Layout03Icon,
  LockKeyIcon,
  PaintBrush01Icon,
  RotateLeft01Icon,
  Scissor01Icon,
  SecurityPasswordIcon,
  SignatureIcon,
  StampIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

type ToolIcon = typeof PaintBrush01Icon | typeof TextFontIcon;

type ToolCard = {
  description: string;
  href: string;
  icon: ToolIcon;
  title: string;
};

/** Row-major order so a 3-column grid matches reference column layout (read down each column). */
const TOOL_CARDS: ToolCard[] = [
  {
    description:
      "Highlight, comment, and mark up pages without leaving your browser.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: PaintBrush01Icon,
    title: "Annotate PDF",
  },
  {
    description:
      "Revise text and objects inline with our full in-browser PDF workspace.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: TextFontIcon,
    title: "Edit PDF",
  },
  {
    description:
      "Draw, type, or upload a signature and place it anywhere on the file.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: SignatureIcon,
    title: "Sign PDF",
  },
  {
    description:
      "Turn PDFs into spreadsheets, Word docs, and more — starting with Excel.",
    href: ROUTES.TOOLS.PDF_TO_EXCEL,
    icon: FileExportIcon,
    title: "Convert Document",
  },
  {
    description: "Combine multiple PDFs into one polished document in order.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: GroupLayersIcon,
    title: "Merge Documents",
  },
  {
    description:
      "Shrink large PDFs with balanced compression presets for sharing.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: ArchiveIcon,
    title: "Compress PDF",
  },
  {
    description:
      "Permanently remove sensitive content before you share or archive.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: SecurityPasswordIcon,
    title: "Redact PDF",
  },
  {
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Layout03Icon,
    title: "Organize Pages",
  },
  {
    description:
      "Pull out the pages you need or split a long file into lighter parts.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Scissor01Icon,
    title: "Split & Extract Pages",
  },
  {
    description:
      "Lock your PDF with a password so only intended readers open it.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: LockKeyIcon,
    title: "Password Protect",
  },
  {
    description: "Remove encryption when you have the right credentials handy.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: FileUnlockedIcon,
    title: "Unlock PDF",
  },
  {
    description:
      "Stamp text or imagery across every page for branding or confidentiality.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: StampIcon,
    title: "Add Watermark",
  },
  {
    description:
      "Fix upside-down scans or mixed-orientation bundles in seconds.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: RotateLeft01Icon,
    title: "Rotate Pages",
  },
  {
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Delete02Icon,
    title: "Delete Pages",
  },
  {
    description:
      "Tighten margins and focus readers on the content that matters.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: CropIcon,
    title: "Crop Pages",
  },
  {
    description:
      "Make scanned pages searchable and selectable with OCR-friendly flows.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: AiScanIcon,
    title: "OCR Pages",
  },
];

type ToolCardTextPreviewProps = {
  description: string;
  title: string;
};

function ToolCardTextPreview({ description, title }: ToolCardTextPreviewProps) {
  return (
    <div
      className={[
        "hidden min-w-0 flex-1 flex-col gap-1 text-start",
        "max-lg:!flex",
        "[@media(pointer:coarse)_and_(min-width:1024px)]:!flex",
        "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:!hidden",
      ].join(" ")}
    >
      <p className="line-clamp-2 text-base font-semibold leading-snug text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="line-clamp-2 text-sm leading-snug text-default-500 dark:text-default-400">
        {description}
      </p>
    </div>
  );
}

/** Desktop + fine pointer: idle shows icon + large title; hover hides icon, shrinks title, reveals description. */
function ToolCardTextDesktopHover({
  description,
  title,
}: ToolCardTextPreviewProps) {
  return (
    <div
      className={[
        "hidden min-w-0 flex-1 flex-col justify-center gap-0 text-start",
        "motion-reduce:transition-none",
        "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:flex",
        "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:transition-[gap] [@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:duration-300",
        "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:gap-1",
      ].join(" ")}
    >
      <p
        className={[
          "line-clamp-2 text-lg font-semibold leading-snug text-[var(--color-foreground)]",
          "motion-reduce:transition-none",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:transition-[font-size,line-height] [@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:duration-300",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:line-clamp-1",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:text-sm",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:leading-tight",
        ].join(" ")}
      >
        {title}
      </p>
      <p
        className={[
          "line-clamp-3 text-sm leading-snug text-default-500 dark:text-default-400",
          "max-h-0 overflow-hidden opacity-0",
          "motion-reduce:transition-none",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:transition-[max-height,opacity,margin-top] [@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:duration-300",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:mt-0.5",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:max-h-[4.75rem]",
          "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:opacity-100",
        ].join(" ")}
      >
        {description}
      </p>
    </div>
  );
}

export function HomeToolGrid() {
  return (
    <section className="w-full py-10" id="pdf-tools">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
          {TOOL_CARDS.map((card) => (
            <Link
              key={card.title}
              className="group block rounded-xl border-2 border-default-200 bg-[var(--color-background)]/80 outline-none backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-[color-mix(in_oklab,var(--color-accent)_50%,transparent)] hover:shadow-md focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent dark:border-default-700"
              href={card.href}
            >
              <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-6 sm:py-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] bg-[var(--color-background)] sm:size-14">
                  <HugeiconsIcon
                    className="text-[var(--color-accent)]"
                    icon={card.icon}
                    size={24}
                  />
                </div>

                <ToolCardTextPreview
                  description={card.description}
                  title={card.title}
                />
                <ToolCardTextDesktopHover
                  description={card.description}
                  title={card.title}
                />

                <span
                  className={[
                    "inline-flex shrink-0 overflow-hidden pt-0.5 motion-reduce:transition-none sm:pt-0",
                    "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:transition-[width,opacity,min-width]",
                    "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:duration-300",
                    "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:w-0",
                    "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:min-w-0",
                    "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:group-hover:opacity-0",
                  ].join(" ")}
                >
                  <HugeiconsIcon
                    aria-hidden
                    className="translate-y-px text-default-400 transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0"
                    icon={ArrowRight01Icon}
                    size={20}
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
