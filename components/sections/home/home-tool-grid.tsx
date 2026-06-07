"use client";

import type { HomeToolCard } from "@/lib/shared/constants/home-tool-grid";

import { useState } from "react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tabs } from "@heroui/react";
import Link from "next/link";

import {
  HOME_TOOL_GRID_BADGE_SUFFIX,
  HOME_TOOL_GRID_HEADING_ACCENT,
  HOME_TOOL_GRID_HEADING_PREFIX,
  HOME_TOOL_GRID_SECTION_ID,
  HOME_TOOL_GRID_SUBTITLE,
  HOME_TOOL_GRID_TAB_GROUPS,
  HOME_TOOL_GRID_TOTAL_TOOL_COUNT,
} from "@/lib/shared/constants/home-tool-grid";

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

function ToolCardTextDesktopHover({
  description,
  title,
}: ToolCardTextPreviewProps) {
  return (
    <div
      className={[
        "hidden min-w-0 flex-1 flex-col justify-center gap-1 text-start",
        "[@media(hover:hover)_and_(pointer:fine)_and_(min-width:1024px)]:flex",
      ].join(" ")}
    >
      <p className="line-clamp-1 text-base font-semibold leading-tight text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="line-clamp-2 text-sm leading-snug text-default-500 dark:text-default-400">
        {description}
      </p>
    </div>
  );
}

function ToolCardGrid({ cards }: { cards: readonly HomeToolCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
      {cards.map((card) => (
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

            <span className="inline-flex shrink-0 pt-0.5 sm:pt-0">
              <HugeiconsIcon
                aria-hidden
                className="translate-y-px text-default-400 transition-transform duration-200 group-hover:translate-x-0.5"
                icon={ArrowRight01Icon}
                size={20}
              />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function HomeToolGrid() {
  const defaultTabId = HOME_TOOL_GRID_TAB_GROUPS[0]!.id;
  const [tab, setTab] = useState<string>(defaultTabId);

  function handleTabChange(key: string | number) {
    setTab(String(key));
  }

  const toolCount = HOME_TOOL_GRID_TOTAL_TOOL_COUNT;

  return (
    <section className="w-full py-10" id={HOME_TOOL_GRID_SECTION_ID}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-12 px-2 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
            {toolCount} {HOME_TOOL_GRID_BADGE_SUFFIX}
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-4xl">
            {HOME_TOOL_GRID_HEADING_PREFIX}{" "}
            <span className="text-[var(--color-accent)]">
              {HOME_TOOL_GRID_HEADING_ACCENT}
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-default-600 dark:text-default-400">
            {HOME_TOOL_GRID_SUBTITLE}
          </p>
        </div>

        <Tabs
          className="w-full flex-col gap-8 px-2"
          selectedKey={tab}
          onSelectionChange={handleTabChange}
        >
          <Tabs.ListContainer className="w-full">
            <Tabs.List
              aria-label="PDF tool categories"
              className="flex w-full flex-col gap-2 rounded-2xl border border-default-200 bg-[var(--color-background)]/90 p-1.5 shadow-sm sm:flex-row sm:gap-1 dark:border-default-700"
            >
              {HOME_TOOL_GRID_TAB_GROUPS.map((group) => (
                <Tabs.Tab
                  key={group.id}
                  className="min-h-11 flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-foreground)] outline-none transition-colors data-[selected=true]:bg-[var(--color-accent)] data-[selected=true]:text-white data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-[var(--color-accent)] data-[hovered=true]:bg-default-100 data-[selected=true]:data-[hovered=true]:bg-[var(--color-accent)] dark:data-[hovered=true]:bg-default-50/10"
                  id={group.id}
                >
                  {group.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {HOME_TOOL_GRID_TAB_GROUPS.map((group) => (
            <Tabs.Panel
              key={group.id}
              className="w-full outline-none"
              id={group.id}
            >
              <ToolCardGrid cards={group.cards} />
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
