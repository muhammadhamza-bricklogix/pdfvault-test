"use client";

import type { Tool, ToolCategory } from "@/lib/shared/types/tools.types";
import type { Key } from "@heroui/react";

import {
  ArrowRight01Icon,
  File01Icon,
  FileExportIcon,
  Image01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Label, Modal, Tabs } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToolsQuery } from "@/lib/client/query/queries/tools.query";

type ToolsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const CATEGORY_TABS: { id: "all" | ToolCategory; label: string }[] = [
  { id: "all", label: "All tools" },
  { id: "pdf", label: "PDF tools" },
  { id: "image", label: "Image tools" },
];

/** Map backend slug ids to local icons. Unknown ids fall back to File01Icon. */
const TOOL_ICONS: Record<string, typeof File01Icon> = {
  "pdf-to-word": TextFontIcon,
  "pdf-to-excel": FileExportIcon,
  "pdf-to-powerpoint": FileExportIcon,
  "pdf-to-html": TextFontIcon,
  "pdf-to-text": TextFontIcon,
  "pdf-to-epub": TextFontIcon,
  "word-to-pdf": File01Icon,
  "excel-to-pdf": File01Icon,
  "powerpoint-to-pdf": File01Icon,
  "pdf-to-jpg": Image01Icon,
  "pdf-to-png": Image01Icon,
  "pdf-to-webp": Image01Icon,
  "pdf-to-tiff": Image01Icon,
  "pdf-to-svg": Image01Icon,
  "pdf-to-bmp": Image01Icon,
  "jpg-to-pdf": File01Icon,
  "png-to-pdf": File01Icon,
};

const iconFor = (id: string) => TOOL_ICONS[id] ?? File01Icon;

/**
 * Tools catalog modal launched from the editor top bar. Renders a tile grid
 * powered by `GET /api/v1/tools`. Clicking a tile navigates to that tool's
 * route — the editor closes via `onClose` on navigation so the modal doesn't
 * persist behind the new page.
 *
 * Tabs filter by backend category (pdf, image). "All tools" shows every tile
 * regardless of category. Loading and error states render in-modal so the
 * editor doesn't have to wrap this in a Suspense boundary.
 */
export function ToolsModal({ isOpen, onClose }: ToolsModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | ToolCategory>("all");

  const category = tab === "all" ? undefined : tab;
  const { data, isLoading, isError } = useToolsQuery({
    category,
    enabled: isOpen,
  });

  const handleTileClick = (tool: Tool) => {
    onClose();
    router.push(tool.route);
  };

  const tiles: Tool[] = data?.items ?? [];

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[920px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Tools</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 p-5">
              <Tabs
                aria-label="Tool categories"
                selectedKey={tab}
                onSelectionChange={(key: Key) =>
                  setTab(key as "all" | ToolCategory)
                }
              >
                <Tabs.List>
                  {CATEGORY_TABS.map((t) => (
                    <Tabs.Tab key={t.id} id={t.id}>
                      {t.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>

              <div className="max-h-[min(560px,calc(85vh-14rem))] overflow-y-auto pr-1">
                {isLoading && (
                  <p className="py-10 text-center text-sm text-default-500">
                    Loading tools…
                  </p>
                )}

                {isError && (
                  <p className="py-10 text-center text-sm text-danger">
                    Could not load tools. Please try again.
                  </p>
                )}

                {!isLoading && !isError && tiles.length === 0 && (
                  <p className="py-10 text-center text-sm text-default-500">
                    No tools available in this category yet.
                  </p>
                )}

                {!isLoading && !isError && tiles.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tiles.map((tool) => {
                      const Icon = iconFor(tool.id);

                      return (
                        <button
                          key={tool.id}
                          aria-label={tool.name}
                          className="group flex items-start gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] p-4 text-left transition hover:border-accent hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          type="button"
                          onClick={() => handleTileClick(tool)}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[var(--color-accent)]">
                            <HugeiconsIcon icon={Icon} size={20} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-center justify-between gap-2">
                              <Label className="truncate text-sm font-semibold">
                                {tool.name}
                              </Label>
                              {tool.isAi && (
                                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-500">
                                  AI
                                </span>
                              )}
                            </span>
                            <span className="line-clamp-2 text-xs text-default-500">
                              {tool.description}
                            </span>
                          </span>
                          <HugeiconsIcon
                            className="mt-1 shrink-0 text-default-400 opacity-0 transition group-hover:opacity-100"
                            icon={ArrowRight01Icon}
                            size={16}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
