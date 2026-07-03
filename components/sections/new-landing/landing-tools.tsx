"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

import { SectionHeading } from "./section-heading";

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

// The reference design only specifies the "Edit & Sign" tab (the 8 cards
// below). Each tool also declares the other tabs it belongs to, so switching
// tabs filters the same catalog instead of duplicating markup.
const TOOLS: Tool[] = [
  {
    icon: "/landing/editor.svg",
    title: "PDF Editor",
    description:
      "Revise text and objects inline with our full in-browser PDF editor.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    tabs: ["edit"],
  },
  {
    icon: "/landing/convert.svg",
    title: "Convert Document",
    description: "Turn PDFs into spreadsheets, Word docs, and more.",
    href: ROUTES.TOOLS.BY_SLUG("convert"),
    tabs: ["edit", "convert-to", "convert-from", "compress"],
  },
  {
    icon: "/landing/organize.svg",
    title: "Organize Pages",
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: ROUTES.TOOLS.BY_SLUG("organize"),
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/split.svg",
    title: "Split & Extract Pages",
    description:
      "Pull out the pages you need or split a long file into lighter ones.",
    href: ROUTES.TOOLS.BY_SLUG("split"),
    tabs: ["edit", "compress", "others"],
  },
  {
    icon: "/landing/password.svg",
    title: "Password Protect",
    description:
      "Lock your PDF with a password so only intended readers get in.",
    href: ROUTES.TOOLS.BY_SLUG("protect"),
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/unlock.svg",
    title: "Unlock PDF",
    description: "Remove encryption when you have the right credentials.",
    href: ROUTES.TOOLS.BY_SLUG("unlock"),
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/rotate.svg",
    title: "Rotate Pages",
    description:
      "Fix upside-down scans or mixed-orientation bundles in seconds.",
    href: ROUTES.TOOLS.BY_SLUG("rotate"),
    tabs: ["edit", "others"],
  },
  {
    icon: "/landing/delete.svg",
    title: "Delete Pages",
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: ROUTES.TOOLS.BY_SLUG("delete"),
    tabs: ["edit", "others"],
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
                  className={`rounded-full px-5 py-2 text-[14px] font-medium transition-colors ${
                    selected
                      ? "bg-[var(--pv-brand-primary)] text-white"
                      : "text-[var(--pv-text-primary)] hover:bg-[var(--pv-section-gray)]"
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

        {/* Tool cards */}
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTools.map((tool) => (
            <li key={tool.title}>
              <a
                className="group flex h-full flex-col rounded-[var(--pv-radius-card)] border border-[var(--pv-card-border)] bg-white p-6 transition-colors hover:border-[var(--pv-gray-5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-primary)]"
                href={tool.href}
              >
                <span className="flex size-12 items-center justify-center rounded-[12px] bg-[var(--pv-section-gray)]">
                  <Image
                    alt=""
                    className="size-6 object-contain"
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
                <span className="mt-4 text-[var(--pv-text-primary)] transition-transform group-hover:translate-x-1">
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
