"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { useRef, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

import { SectionHeading } from "./section-heading";

/**
 * Signed-in users clicking a composer/others tile used to briefly land on
 * the marketing landing page or `/pdf-composer?fresh=1&tool=<slug>` before
 * `PendingEditorFileHydrator` bounced them to `/dashboard?openPicker=<slug>`
 * — visible URL flash and an unnecessary editor mount. Send them straight
 * to the picker route from the click so nothing intermediate paints.
 * Signed-out users get the marketing landing page (`href`) — they have
 * no library to pick from, so the drop-zone flow is correct for them.
 *
 * `toolSlug` is opt-in per tile: composer/others tools set it so their
 * signed-in click routes through `openPicker`; convert tiles leave it
 * unset so signed-in users land on the same marketing URL as guests.
 */
function resolveToolHref(
  rawHref: string,
  toolSlug: string | undefined,
  isSignedIn: boolean,
): string {
  if (!isSignedIn) return rawHref;
  if (!toolSlug) return rawHref;

  return `${ROUTES.APP.DASHBOARD}?openPicker=${encodeURIComponent(toolSlug)}`;
}

const convert = (slug: string) => `/convert/${slug}` as const;

type TabId = "edit" | "convert-to" | "compress" | "convert-from" | "others";

type Tab = { id: TabId; label: string };

type Tool = {
  icon: string;
  title: string;
  description: string;
  href: string;
  tabs: TabId[];
  /**
   * Composer/others tools set this to the `?tool=<slug>` value the editor
   * would open with (e.g. `"edit"`, `"manage"`, `"compress"`). Used by
   * `resolveToolHref` to route signed-in users to `/dashboard?openPicker=<slug>`
   * instead of the guest marketing page. Convert tiles leave it unset.
   */
  toolSlug?: string;
};

const TABS: Tab[] = [
  { id: "edit", label: "PDF Composer" },
  { id: "convert-to", label: "Convert to PDF" },
  { id: "convert-from", label: "Convert from PDF" },
  { id: "compress", label: "Compress" },
  { id: "others", label: "Others" },
];

// Catalog of every landing-page tool. Each tool declares the tabs it belongs
// to, so switching tabs filters the same list instead of duplicating markup.
// The design shipped with only 8 Edit & Sign entries — the Convert / Compress
// / Others tabs were near-empty. This expansion re-uses the existing eight
// tool SVGs (grouped by shape) so no new assets are required, while keeping
// each tab well-populated.
const TOOLS: Tool[] = [
  // ─── Edit & Sign ────────────────────────────────────────────────────────
  // Composer/others tiles link to the shared marketing landing pages
  // (`ToolLandingPage`) — same hero + `UploadWorkspace(variant="hero")`
  // the `/convert/[slug]` routes use — so every uploader sees the same
  // "Drag & drop file to edit" screen. `toolSlug` preserves the
  // signed-in dashboard-picker shortcut inside `resolveToolHref`.
  {
    icon: "/landing/editor.svg",
    title: "Edit",
    description:
      "Revise text and objects inline with our full in-browser PDF composer.",
    href: "/edit",
    toolSlug: "edit",
    tabs: ["edit"],
  },
  {
    icon: "/landing/signature.svg",
    title: "Sign",
    description: "Add your signature with vector strokes.",
    href: "/sign-pdf",
    toolSlug: "sign",
    tabs: ["edit"],
  },
  {
    icon: "/landing/editor.svg",
    title: "Watermark",
    description: "Stamp a watermark with vector strokes.",
    href: "/watermark-pdf",
    toolSlug: "watermark",
    tabs: ["others"],
  },
  {
    icon: "/landing/organize.svg",
    title: "Organize Pages",
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: "/organize-pdf",
    toolSlug: "manage",
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/split.svg",
    title: "Split & Extract Pages",
    description:
      "Pull out the pages you need or split a long file into lighter ones.",
    href: "/split-pdf",
    toolSlug: "split",
    tabs: ["edit", "compress", "others"],
  },
  {
    icon: "/landing/password.svg",
    title: "Password Protect",
    description:
      "Lock your PDF with a password so only intended readers get in.",
    href: "/password-protect-pdf",
    toolSlug: "password",
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/unlock.svg",
    title: "Unlock PDF",
    description: "Remove encryption when you have the right credentials.",
    href: "/unlock-pdf",
    toolSlug: "unlock",
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/rotate.svg",
    title: "Rotate Pages",
    description:
      "Fix upside-down scans or mixed-orientation bundles in seconds.",
    href: "/rotate-pdf",
    toolSlug: "manage",
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/delete.svg",
    title: "Delete Pages",
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: "/delete-pages",
    toolSlug: "manage",
    tabs: ["edit", "others"],
  },

  // ─── Convert to PDF ─────────────────────────────────────────────────────
  {
    icon: "/landing/convert.svg",
    title: "Word to PDF",
    description: "Upload a .doc or .docx and get a clean PDF, ready to share.",
    href: convert("word-to-pdf"),
    tabs: ["convert-to"],
  },
  // Hidden 2026-08-28 — Excel/PowerPoint conversions parked pending
  // future work. Do not remove; re-enable when pipelines are ready.
  // {
  //   icon: "/landing/convert.svg",
  //   title: "Excel to PDF",
  //   description: "Turn .xls or .xlsx spreadsheets into print-ready PDFs.",
  //   href: convert("excel-to-pdf"),
  //   tabs: ["convert-to"],
  // },
  // {
  //   icon: "/landing/convert.svg",
  //   title: "PowerPoint to PDF",
  //   description: "Convert .ppt or .pptx decks into shareable PDF slides.",
  //   href: convert("powerpoint-to-pdf"),
  //   tabs: ["convert-to"],
  // },
  {
    icon: "/landing/convert.svg",
    title: "JPG to PDF",
    description: "Turn JPG photos or scans into a single, tidy PDF.",
    href: convert("jpg-to-pdf"),
    tabs: ["convert-to"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PNG to PDF",
    description:
      "Drop one or more PNGs and we'll bundle them into a single PDF.",
    href: convert("png-to-pdf"),
    tabs: ["convert-to"],
  },
  // TXT to PDF hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
  // {
  //   icon: "/landing/convert.svg",
  //   title: "TXT to PDF",
  //   description: "Wrap a plain-text file into a formatted, page-ready PDF.",
  //   href: convert("txt-to-pdf"),
  //   tabs: ["convert-to"],
  // },

  // ─── Compress PDF ───────────────────────────────────────────────────────
  {
    icon: "/landing/convert.svg",
    title: "Compress PDF",
    description: "Reduce file size with three compression levels.",
    href: "/compress",
    toolSlug: "compress",
    tabs: ["compress"],
  },
  {
    icon: "/landing/organize.svg",
    title: "Merge & Compress",
    description: "Combine multiple PDFs and squeeze them in a single pass.",
    href: "/organize-pdf",
    toolSlug: "manage",
    tabs: ["compress"],
  },

  // ─── Convert from PDF ───────────────────────────────────────────────────
  {
    icon: "/landing/convert.svg",
    title: "Convert File to PDF",
    description:
      // Excel + PowerPoint hidden 2026-08-28. GIF/HTML/TXT hidden
      // 2026-08-29 (PM: PDF/Word/PNG/JPG only).
      "Supported formats: Word, JPG, PNG.",
    href: convert("file-to-pdf"),
    tabs: ["convert-to"],
  },
  // Hidden 2026-08-28 — PDF → Excel/PowerPoint parked pending future
  // work. Do not remove; re-enable when pipelines are ready.
  // {
  //   icon: "/landing/convert.svg",
  //   title: "PDF to Excel",
  //   description: "Pull tables out of a PDF and into a ready-to-edit Excel.",
  //   href: convert("pdf-to-excel"),
  //   tabs: ["convert-from"],
  // },
  // {
  //   icon: "/landing/convert.svg",
  //   title: "PDF to PowerPoint",
  //   description: "Turn a PDF into a .pptx deck, one slide per page.",
  //   href: convert("pdf-to-powerpoint"),
  //   tabs: ["convert-from"],
  // },
  {
    icon: "/landing/convert.svg",
    title: "PDF to JPG",
    description: "Export every page of a PDF as a JPG image.",
    href: convert("pdf-to-jpg"),
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to PNG",
    description: "Export every page of a PDF as a high-quality PNG.",
    href: convert("pdf-to-png"),
    tabs: ["convert-from"],
  },
  // PDF to HTML + PDF to Plain Text hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
  // {
  //   icon: "/landing/convert.svg",
  //   title: "PDF to HTML",
  //   description: "Turn a PDF into a lightweight HTML page you can embed.",
  //   href: convert("pdf-to-html"),
  //   tabs: ["convert-from"],
  // },
  // {
  //   icon: "/landing/convert.svg",
  //   title: "PDF to Plain Text",
  //   description: "Extract the raw text from a PDF as a plain .txt file.",
  //   href: convert("pdf-to-text"),
  //   tabs: ["convert-from"],
  // },

  // ─── Others ─────────────────────────────────────────────────────────────
  {
    icon: "/landing/split.svg",
    title: "Extract Images",
    description: "Pull every embedded image out of a PDF in one click.",
    href: "/extract-images",
    toolSlug: "extract-images",
    tabs: ["others"],
  },
  {
    icon: "/landing/delete.svg",
    title: "Remove Annotations",
    description: "Strip notes, highlights, and comments in one pass.",
    href: "/remove-annotations",
    toolSlug: "flatten",
    tabs: ["others"],
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden fill="none" height="18" viewBox="0 0 20 20" width="18">
      <path
        d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Mobile initial-view cap per tab. Users on small screens had to scroll
// through the full 8-tool "Edit & Sign" tab before reaching the next
// section — reviewers flagged it. Cap the first paint at 4 with a
// "View more" toggle that expands to the full list for the active tab.
const MOBILE_INITIAL_COUNT = 4;

export function LandingTools() {
  const { isSignedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("edit");
  const [expanded, setExpanded] = useState(false);
  // Reset "View more" whenever the active tab changes so a fresh tab
  // always paints its capped view. React's adjust-state-during-render
  // pattern (used elsewhere in this repo — see dashboard-home.tsx) is
  // preferred over a mount effect + setState so the initial paint of
  // the new tab is already in the correct state, and to satisfy the
  // repo's `react-hooks/set-state-in-effect` lint rule.
  const [lastTab, setLastTab] = useState<TabId>(activeTab);

  if (lastTab !== activeTab) {
    setLastTab(activeTab);
    setExpanded(false);
  }
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving-tabindex keyboard navigation across the segmented control.
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const lastIndex = TABS.length - 1;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight")
      nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === "ArrowLeft")
      nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;

    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const visibleTools = TOOLS.filter((tool) => tool.tabs.includes(activeTab));

  return (
    <section
      aria-labelledby="tools-heading"
      className="bg-[var(--pv-section-gray)] pt-8 pb-20 sm:pt-10 sm:pb-24"
    >
      <div className="pv-container">
        <SectionHeading
          description="Every tool you need to use PDFs, at your fingertips. Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks."
          title={
            <span id="tools-heading">
              Every tool you need to work
              <br className="hidden sm:block" /> with PDFs in one place
            </span>
          }
        />

        {/* Segmented tab control */}
        <div className="mt-10 flex justify-center">
          <div
            aria-label="Tool categories"
            // `p-2 sm:p-1` — mobile bumps the inner gutter from 4px to 8px
            // so the selected pill (which has `scale-[1.02]` and a soft
            // shadow) no longer visually touches the outer container edge.
            // Desktop keeps the tighter `p-1` since tabs sit in a single
            // row there and 4px reads clean.
            className="inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-[var(--pv-card-border)] bg-white p-2 sm:p-1"
            role="tablist"
          >
            {TABS.map((tab, index) => {
              const selected = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  aria-selected={selected}
                  className={`cursor-pointer rounded-full px-5 py-2 text-[14px] font-medium transition-all duration-300 ease-out ${
                    selected
                      ? "scale-[1.02] bg-[var(--pv-brand-primary)] text-white shadow-[0_6px_16px_-6px_rgba(241,44,35,0.55)]"
                      : "text-[var(--pv-text-secondary)] hover:bg-[var(--pv-section-gray)] hover:text-[var(--pv-text-primary)]"
                  }`}
                  role="tab"
                  tabIndex={selected ? 0 : -1}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/*
          Tool cards. `key={activeTab}` re-mounts the whole list when the tab
          changes, which retriggers the CSS enter animation. Each item's
          `animationDelay` staggers the reveal so the grid cascades rather
          than blinking in as a slab.
        */}
        <ul
          key={activeTab}
          className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {visibleTools.map((tool, index) => {
            const hideOnMobile = !expanded && index >= MOBILE_INITIAL_COUNT;

            return (
              <li
                key={tool.title}
                className={`pv-fade-up ${hideOnMobile ? "hidden sm:block" : ""}`.trim()}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <a
                  className="group flex h-full flex-col rounded-[var(--pv-radius-card)] border border-[var(--pv-card-border)] bg-white p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--pv-brand-primary)]/40 hover:shadow-[0_18px_38px_-24px_rgba(241,44,35,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)]"
                  href={resolveToolHref(
                    tool.href,
                    tool.toolSlug,
                    Boolean(isSignedIn),
                  )}
                >
                  <span className="mx-auto flex size-12 items-center justify-center rounded-[12px] bg-[var(--pv-section-gray)] transition-colors duration-300 group-hover:bg-[var(--pv-brand-primary)]/10">
                    <Image
                      alt=""
                      className="size-6 object-contain transition-transform duration-300 group-hover:scale-110"
                      height={24}
                      src={tool.icon}
                      width={24}
                    />
                  </span>
                  <h3 className="mt-5 text-[18px] font-bold text-[var(--pv-text-primary)]">
                    {tool.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[var(--pv-text-secondary)]">
                    {tool.description}
                  </p>
                  <span className="mt-4 text-[var(--pv-text-primary)] transition-transform duration-300 group-hover:translate-x-1.5">
                    <ArrowIcon />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        {visibleTools.length > MOBILE_INITIAL_COUNT && !expanded ? (
          <div className="mt-6 flex justify-center sm:hidden">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--pv-card-border)] bg-white px-6 text-[14px] font-semibold text-[var(--pv-text-primary)] shadow-sm transition-colors hover:bg-[var(--pv-section-gray)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)]"
              type="button"
              onClick={() => setExpanded(true)}
            >
              View more
              <span className="text-[var(--pv-text-secondary)]">
                (+{visibleTools.length - MOBILE_INITIAL_COUNT})
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
