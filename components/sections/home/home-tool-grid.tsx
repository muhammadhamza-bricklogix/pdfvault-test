import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import {
  HOME_TOOL_GRID_BADGE_SUFFIX,
  HOME_TOOL_GRID_HEADING_ACCENT,
  HOME_TOOL_GRID_HEADING_PREFIX,
  HOME_TOOL_GRID_SECTION_ID,
  HOME_TOOL_GRID_SUBTITLE,
  HOME_TOOL_GRID_TOOL_CARDS,
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
  const toolCount = HOME_TOOL_GRID_TOOL_CARDS.length;

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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
          {HOME_TOOL_GRID_TOOL_CARDS.map((card) => (
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
