/**
 * One-line guidance toast shown when the composer opens from a tool page.
 * Keyed by the `?hint=` param when present, otherwise by `?tool=`.
 */
export const TOOL_HINTS: Record<
  string,
  { title: string; description: string }
> = {
  edit: {
    title: "Edit PDF",
    description:
      "Click any text on the page to change it, or pick another tool from the toolbar.",
  },
  sign: {
    title: "Sign PDF",
    description:
      "Draw, type or upload your signature, then place it on the page.",
  },
  watermark: {
    title: "Watermark PDF",
    description:
      "Set your watermark text or image in the panel, then switch Watermark on.",
  },
  split: {
    title: "Split PDF",
    description: "Choose how to split the file, then click Split & download.",
  },
  manage: {
    title: "Organize pages",
    description:
      "Drag pages to reorder them, or select pages and use the toolbar. Click Save when you're done.",
  },
  delete: {
    title: "Delete pages",
    description:
      "Select the pages you want to remove, click Delete Pages, then click Save.",
  },
  rotate: {
    title: "Rotate pages",
    description:
      "Select the pages, open the dotted menu icon and choose Rotate Left or Rotate Right, then click Save.",
  },
};

export function getToolHint(key: string) {
  return Object.hasOwn(TOOL_HINTS, key) ? TOOL_HINTS[key] : undefined;
}
