import type { DriveStep, DriverHook } from "driver.js";

import { MOBILE_MEDIA_QUERY } from "@/lib/shared/utils/media-queries";

// Every target below expects the corresponding component to expose
// `data-tour="<id>"` on a stable DOM node. Tours skip missing targets
// gracefully (driver.js falls back to a modal-style hint).

export const TOUR_STORAGE_KEYS = {
  dashboard: "pdfvault:tour:dashboard:seen",
  editor: "pdfvault:tour:editor:seen",
} as const;

// QA 2026-09-22 (issue #20, second follow-up — the first pass fixed
// which ROUTE the tour runs on, not this): on mobile, `dashboard-nav`
// and `dashboard-profile` live inside the sidebar's off-canvas drawer
// (`DashboardShell`'s `<aside>`), which is only CSS-transformed
// on/off-screen — never unmounted. So `document.querySelector` always
// finds them, and driver.js highlights whatever their CURRENT
// (possibly off-screen) position is. If the drawer is open while
// `dashboard-upload`/`dashboard-quick-tools` (both in `<main>`, hidden
// behind the drawer's own backdrop when it's open) are being
// highlighted, or closed while `dashboard-nav`/`dashboard-profile` are
// being highlighted, the stage ends up pointing at nothing meaningful
// — exactly the blank highlighted box the user screenshotted on step 3.
// `DASHBOARD_MOBILE_SIDEBAR_EVENT` lets this plain config module (no
// React tree of its own) tell `DashboardShell` to open/close the
// drawer per step; `DashboardShell` is the sole listener.
export const DASHBOARD_MOBILE_SIDEBAR_EVENT = "dashboard:set-mobile-sidebar";

// Matches `DashboardShell`'s drawer `transition-transform duration-200`
// plus a small buffer, so `refresh()` (below) fires only once the slide
// animation has actually settled — calling it mid-transition would
// still measure the wrong (in-between) position.
const SIDEBAR_TRANSITION_MS = 220;

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/**
 * Per-step `onHighlightStarted` hook: puts the mobile drawer into the
 * state this step's target needs, then re-measures the highlight once
 * the CSS transition has settled. A no-op on desktop (`DashboardShell`
 * only reads this event on the off-canvas mobile branch) and cheap even
 * when the drawer is already in the right state — `refresh()` is safe
 * to call unconditionally. Runs on every entry into a step (initial
 * `drive()`, Next, Back, or `moveTo`), so it self-corrects regardless
 * of which direction the user navigated from.
 */
function ensureMobileSidebar(open: boolean): DriverHook {
  return (_element, _step, opts) => {
    if (!isMobileViewport()) return;

    window.dispatchEvent(
      new CustomEvent(DASHBOARD_MOBILE_SIDEBAR_EVENT, { detail: { open } }),
    );
    window.setTimeout(() => opts.driver.refresh(), SIDEBAR_TRANSITION_MS);
  };
}

const DASHBOARD_STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard-nav"]',
    popover: {
      title: "Your workspace",
      description:
        "Jump between Home, My PDFs, and Tools. Everything you own or edit lives one click away.",
    },
    onHighlightStarted: ensureMobileSidebar(true),
  },
  {
    element: '[data-tour="dashboard-upload"]',
    popover: {
      title: "Upload a PDF",
      description:
        "Drag a file in or browse to add one. Your document opens in the editor as soon as it's ready.",
    },
    onHighlightStarted: ensureMobileSidebar(false),
  },
  {
    element: '[data-tour="dashboard-quick-tools"]',
    popover: {
      title: "Quick tools",
      description:
        "Convert, edit, sign, organize, and secure — pick a card to start from a saved file or a fresh upload.",
    },
    onHighlightStarted: ensureMobileSidebar(false),
  },
  {
    element: '[data-tour="dashboard-profile"]',
    popover: {
      title: "Account & settings",
      description:
        "Manage your profile, subscription, and preferences from here. Sign out and language options live inside too.",
    },
    onHighlightStarted: ensureMobileSidebar(true),
  },
];

const EDITOR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="editor-menu"]',
    popover: {
      title: "Editor menu",
      description:
        "Open, save, import, and manage the whole document from one place.",
    },
  },
  {
    element: '[data-tour="editor-tools-a"]',
    popover: {
      title: "Selection & content",
      description:
        "Select, edit existing text, sign, add text, draw, and highlight — the everyday edits.",
    },
  },
  {
    element: '[data-tour="editor-tools-b"]',
    popover: {
      title: "Shapes & imagery",
      description:
        "Add shapes, whiteout or redact sensitive areas, erase strokes, and drop in images, watermarks, or backgrounds.",
    },
  },
  {
    element: '[data-tour="editor-tools-c"]',
    popover: {
      title: "Document actions",
      description:
        "Compress, secure, merge, split, flatten, extract, number pages, and annotate — one-click document operations.",
    },
  },
  {
    element: '[data-tour="editor-share"]',
    popover: {
      title: "Share via link",
      description: "Generate a private share link once your file is saved.",
    },
  },
  {
    element: '[data-tour="editor-download"]',
    popover: {
      title: "Download",
      // Excel/PowerPoint hidden 2026-08-28 pending pipeline work.
      description: "Export as PDF, Word, image, HTML, or plain text.",
    },
  },
];

export const TOURS = {
  dashboard: DASHBOARD_STEPS,
  editor: EDITOR_STEPS,
} as const;

export type TourKey = keyof typeof TOURS;
