import type { DriveStep } from "driver.js";

// Every target below expects the corresponding component to expose
// `data-tour="<id>"` on a stable DOM node. Tours skip missing targets
// gracefully (driver.js falls back to a modal-style hint).

export const TOUR_STORAGE_KEYS = {
  dashboard: "pdfvault:tour:dashboard:seen",
  editor: "pdfvault:tour:editor:seen",
} as const;

const DASHBOARD_STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard-nav"]',
    popover: {
      title: "Your workspace",
      description:
        "Jump between Home, My PDFs, and Tools. Everything you own or edit lives one click away.",
    },
  },
  {
    element: '[data-tour="dashboard-upload"]',
    popover: {
      title: "Upload a PDF",
      description:
        "Drag a file in or browse to add one. Your document opens in the editor as soon as it's ready.",
    },
  },
  {
    element: '[data-tour="dashboard-quick-tools"]',
    popover: {
      title: "Quick tools",
      description:
        "Convert, edit, sign, organize, and secure — pick a card to start from a saved file or a fresh upload.",
    },
  },
  {
    element: '[data-tour="dashboard-profile"]',
    popover: {
      title: "Account & settings",
      description:
        "Manage your profile, subscription, and preferences from here. Sign out and language options live inside too.",
    },
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
