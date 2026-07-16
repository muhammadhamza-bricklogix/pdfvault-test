"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

import { SectionHeading } from "./section-heading";

const DASHBOARD = ROUTES.APP.DASHBOARD;

type TabId = "edit" | "convert-to" | "compress" | "convert-from" | "others";

type Tab = { id: TabId; label: string };

type Tool = {
  icon: string;
  title: string;
  description: string;
  href: string;
  tabs: TabId[];
};

const TABS: Tab[] = [
  { id: "edit", label: "Edit & Sign" },
  { id: "convert-to", label: "Convert to PDF" },
  { id: "compress", label: "Compress PDF" },
  { id: "convert-from", label: "Convert from PDF" },
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
  {
    icon: "/landing/editor.svg",
    title: "PDF Composer",
    description:
      "Revise text and objects inline with our full in-browser PDF composer.",
    href: DASHBOARD,
    tabs: ["edit"],
  },
  {
    icon: "/landing/editor.svg",
    title: "Sign & Watermark",
    description: "Sign and watermark with vector strokes.",
    href: DASHBOARD,
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/organize.svg",
    title: "Organize Pages",
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: DASHBOARD,
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/split.svg",
    title: "Split & Extract Pages",
    description:
      "Pull out the pages you need or split a long file into lighter ones.",
    href: DASHBOARD,
    tabs: ["edit", "compress", "others"],
  },
  {
    icon: "/landing/password.svg",
    title: "Password Protect",
    description:
      "Lock your PDF with a password so only intended readers get in.",
    href: DASHBOARD,
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/unlock.svg",
    title: "Unlock PDF",
    description: "Remove encryption when you have the right credentials.",
    href: DASHBOARD,
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/rotate.svg",
    title: "Rotate Pages",
    description:
      "Fix upside-down scans or mixed-orientation bundles in seconds.",
    href: DASHBOARD,
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/delete.svg",
    title: "Delete Pages",
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: DASHBOARD,
    tabs: ["edit", "others"],
  },

  // ─── Convert to PDF ─────────────────────────────────────────────────────
  {
    icon: "/landing/convert.svg",
    title: "Word to PDF",
    description: "Upload a .doc or .docx and get a clean PDF, ready to share.",
    href: DASHBOARD,
    tabs: ["convert-to"],
  },
  {
    icon: "/landing/convert.svg",
    title: "Excel to PDF",
    description: "Turn .xls or .xlsx spreadsheets into print-ready PDFs.",
    href: DASHBOARD,
    tabs: ["convert-to"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PowerPoint to PDF",
    description: "Convert .ppt or .pptx decks into shareable PDF slides.",
    href: DASHBOARD,
    tabs: ["convert-to"],
  },
  {
    icon: "/landing/convert.svg",
    title: "JPG to PDF",
    description: "Turn JPG photos or scans into a single, tidy PDF.",
    href: DASHBOARD,
    tabs: ["convert-to"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PNG to PDF",
    description: "Drop one or more PNGs and bundle them into one PDF.",
    href: DASHBOARD,
    tabs: ["convert-to"],
  },
  {
    icon: "/landing/convert.svg",
    title: "TXT to PDF",
    description: "Wrap a plain-text file into a formatted, page-ready PDF.",
    href: DASHBOARD,
    tabs: ["convert-to"],
  },
  // "Any Format to PDF" tile hidden per PM review 2026-07 (no backend
  // pipeline for arbitrary formats yet).

  // ─── Compress PDF ───────────────────────────────────────────────────────
  {
    icon: "/landing/convert.svg",
    title: "Compress PDF",
    description: "Reduce file size with three compression levels.",
    href: DASHBOARD,
    tabs: ["compress"],
  },
  // "Reduce Images" tile hidden per PM review 2026-07 (not shipped).
  {
    icon: "/landing/organize.svg",
    title: "Merge & Compress",
    description: "Combine multiple PDFs and squeeze them in a single pass.",
    href: DASHBOARD,
    tabs: ["compress"],
  },

  // ─── Convert from PDF ───────────────────────────────────────────────────
  {
    icon: "/landing/convert.svg",
    title: "PDF to Word",
    description: "Turn a PDF into an editable .docx you can keep working in.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to Excel",
    description: "Pull tables out of a PDF and into a ready-to-edit Excel.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to PowerPoint",
    description: "Turn a PDF into a .pptx deck, one slide per page.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to JPG",
    description: "Export every page of a PDF as a JPG image.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to PNG",
    description: "Export every page of a PDF as a high-quality PNG.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to HTML",
    description: "Turn a PDF into a lightweight HTML page you can embed.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },
  {
    icon: "/landing/convert.svg",
    title: "PDF to Plain Text",
    description: "Extract the raw text from a PDF as a plain .txt file.",
    href: DASHBOARD,
    tabs: ["convert-from"],
  },

  // ─── Others ─────────────────────────────────────────────────────────────
  {
    icon: "/landing/editor.svg",
    title: "Edit Metadata",
    description: "Rewrite the title, author, and other PDF metadata fields.",
    href: DASHBOARD,
    tabs: ["others"],
  },
  {
    icon: "/landing/split.svg",
    title: "Extract Images",
    description: "Pull every embedded image out of a PDF in one click.",
    href: DASHBOARD,
    tabs: ["others"],
  },
  // "Crop PDF" + "OCR PDF" tiles hidden per PM review 2026-07 (not shipped).
  {
    icon: "/landing/delete.svg",
    title: "Remove Annotations",
    description: "Strip notes, highlights, and comments in one pass.",
    href: DASHBOARD,
    tabs: ["others"],
  },
  {
    icon: "/landing/rotate.svg",
    title: "Repair PDF",
    description: "Recover corrupt or partially damaged PDFs.",
    href: DASHBOARD,
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

export function LandingTools() {
  const [activeTab, setActiveTab] = useState<TabId>("edit");
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
      className="bg-[var(--pv-section-gray)] py-20 sm:py-24"
    >
      <div className="pv-container">
        <SectionHeading
          description="Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use! Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks."
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
            className="inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-[var(--pv-card-border)] bg-white p-1"
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
          {visibleTools.map((tool, index) => (
            <li
              key={tool.title}
              className="pv-fade-up"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <a
                className="group flex h-full flex-col rounded-[var(--pv-radius-card)] border border-[var(--pv-card-border)] bg-white p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--pv-brand-primary)]/40 hover:shadow-[0_18px_38px_-24px_rgba(241,44,35,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)]"
                href={tool.href}
              >
                <span className="flex size-12 items-center justify-center rounded-[12px] bg-[var(--pv-section-gray)] transition-colors duration-300 group-hover:bg-[var(--pv-brand-primary)]/10">
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
          ))}
        </ul>
      </div>
    </section>
  );
}
