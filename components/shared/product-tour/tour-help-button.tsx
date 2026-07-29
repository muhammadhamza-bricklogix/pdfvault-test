"use client";

import type { TourKey } from "@/lib/client/tour/tour-config";

import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useProductTour } from "@/lib/client/tour/use-product-tour";

type Variant = "sidebar" | "chrome";

type TourHelpButtonProps = {
  tour: TourKey;
  variant?: Variant;
  label?: string;
};

export function TourHelpButton({
  tour,
  variant = "sidebar",
  label = "Show me around",
}: TourHelpButtonProps) {
  const { start } = useProductTour(tour);

  if (variant === "chrome") {
    return (
      <button
        aria-label={label}
        className="hidden md:inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-default-200 bg-white text-default-600 transition-colors hover:bg-default-100 hover:text-default-800"
        title={label}
        type="button"
        onClick={start}
      >
        <HugeiconsIcon icon={HelpCircleIcon} size={16} />
      </button>
    );
  }

  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)]/60 hover:text-[var(--pv-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
      type="button"
      onClick={start}
    >
      <HugeiconsIcon
        className="shrink-0"
        icon={HelpCircleIcon}
        size={18}
        strokeWidth={1.5}
      />
      <span>{label}</span>
    </button>
  );
}
