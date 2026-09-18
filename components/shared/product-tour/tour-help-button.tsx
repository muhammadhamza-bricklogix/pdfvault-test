"use client";

import type { TourKey } from "@/lib/client/tour/tour-config";

import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname, useRouter } from "next/navigation";

import { useProductTour } from "@/lib/client/tour/use-product-tour";
import { ROUTES } from "@/lib/shared/constants/routes";

type Variant = "sidebar" | "chrome";

type TourHelpButtonProps = {
  tour: TourKey;
  variant?: Variant;
  label?: string;
};

// Mobile UX #20: the "dashboard" tour's `dashboard-upload` and
// `dashboard-quick-tools` anchors only exist on the dashboard HOME route
// (`/dashboard`, rendered by `DashboardHome`) — `dashboard-nav` and
// `dashboard-profile` live in the shared `DashboardShell` and render on
// every dashboard route (`/dashboard/tools`, `/dashboard/forms`, etc).
// This button is mounted inside that same shared shell, so clicking it
// from one of those other routes used to run the tour in place against a
// page missing half its targets (driver.js silently skips them — no
// crash, just a broken-looking tour). Only "dashboard" has this problem;
// the "editor" tour only ever renders on the editor's own single route,
// so it's left out of this map and behaves exactly as before.
const TOUR_HOME_PATH: Partial<Record<TourKey, string>> = {
  dashboard: ROUTES.APP.DASHBOARD,
};

export function TourHelpButton({
  tour,
  variant = "sidebar",
  label = "Show me around",
}: TourHelpButtonProps) {
  const { start } = useProductTour(tour);
  const pathname = usePathname();
  const router = useRouter();
  const homePath = TOUR_HOME_PATH[tour];

  const handleClick = () => {
    if (homePath && pathname !== homePath) {
      // Land on the tour's home page first — it picks up `?tour=<key>`
      // (see `DashboardHome`) and starts this same tour once its own
      // anchors have mounted, instead of running it here.
      router.push(`${homePath}?tour=${tour}`);

      return;
    }
    start();
  };

  if (variant === "chrome") {
    return (
      <button
        aria-label={label}
        className="hidden md:inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-default-200 bg-white text-default-600 transition-colors hover:bg-default-100 hover:text-default-800"
        title={label}
        type="button"
        onClick={handleClick}
      >
        <HugeiconsIcon icon={HelpCircleIcon} size={16} />
      </button>
    );
  }

  return (
    <button
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--pv-text-body)] transition-colors hover:bg-[var(--pv-nav-active)]/60 hover:text-[var(--pv-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)]"
      type="button"
      onClick={handleClick}
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
