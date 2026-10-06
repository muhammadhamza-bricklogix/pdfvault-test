"use client";

import type { Canvas } from "fabric";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Tabs } from "@heroui/react";

import { getLastPointer } from "@/lib/client/pdf-editor/last-pointer";
import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { FileUpload } from "@/components/ui/file-upload/file-upload";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

// Parses "1, 3, 5-7" into [1, 3, 5, 6, 7], deduped and sorted. Silently
// clamps to [1, totalPages] and drops out-of-range or malformed tokens.
// Returns null when the input is entirely empty (caller decides how to
// handle — usually treat as "nothing selected").
function parsePageRange(raw: string, totalPages: number): number[] | null {
  const trimmed = raw.trim();

  if (!trimmed) return null;
  const set = new Set<number>();

  for (const token of trimmed.split(",")) {
    const t = token.trim();

    if (!t) continue;
    const rangeMatch = t.match(/^(\d+)\s*-\s*(\d+)$/);

    if (rangeMatch) {
      const start = Math.max(
        1,
        Math.min(totalPages, parseInt(rangeMatch[1], 10)),
      );
      const end = Math.max(
        1,
        Math.min(totalPages, parseInt(rangeMatch[2], 10)),
      );

      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        set.add(i);
      }
      continue;
    }

    const n = parseInt(t, 10);

    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      set.add(n);
    }
  }
  const arr = Array.from(set).sort((a, b) => a - b);

  return arr.length > 0 ? arr : null;
}

type SignatureModalProps = {
  fabricCanvas: Canvas | null;
  isOpen: boolean;
  onClose: () => void;
};

type PanelProps = {
  onSignatureReady: (dataUrl: string | null) => void;
};

// ---------------------------------------------------------------------------
// Draw Tab
// ---------------------------------------------------------------------------
function SignatureDrawPanel({ onSignatureReady }: PanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;

    const init = async () => {
      const { Canvas: FabricCanvas, PencilBrush } = await import("fabric");

      if (cancelled || !canvasRef.current) return;

      const fc = new FabricCanvas(canvasRef.current, {
        backgroundColor: "transparent",
        height: 150,
        isDrawingMode: true,
        width: 400,
      });

      const brush = new PencilBrush(fc);

      brush.color = "#000000";
      brush.width = 2;
      brush.strokeLineCap = "round";
      brush.strokeLineJoin = "round";
      fc.freeDrawingBrush = brush;

      fc.on("path:created", () => {
        onSignatureReady(fc.toDataURL({ format: "png", multiplier: 3 }));
      });

      fabricRef.current = fc;
    };

    init();

    return () => {
      cancelled = true;
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [onSignatureReady]);

  const handleClear = () => {
    const fc = fabricRef.current;

    if (!fc) return;

    fc.clear();
    fc.backgroundColor = "transparent";
    fc.renderAll();
    onSignatureReady(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-lg border border-default-200 bg-white">
        <canvas ref={canvasRef} />
      </div>
      <Button size="sm" variant="ghost" onPress={handleClear}>
        Clear
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type Tab
// ---------------------------------------------------------------------------
// Fonts loaded in `app/(tools)/layout.tsx` via next/font/google. Each
// row's `css` value must match the CSS variable that layout attaches to
// the wrapper `<div>` \u2014 the preview reads it via `getComputedStyle`
// and the canvas render uses the resolved font-family to paint the PNG.
const TYPE_FONTS = [
  { id: "dancing", label: "Dancing Script", css: "var(--font-dancing-script)" },
  { id: "great-vibes", label: "Great Vibes", css: "var(--font-great-vibes)" },
  { id: "allura", label: "Allura", css: "var(--font-allura)" },
  { id: "sacramento", label: "Sacramento", css: "var(--font-sacramento)" },
  { id: "pacifico", label: "Pacifico", css: "var(--font-pacifico)" },
] as const;

type TypeFontId = (typeof TYPE_FONTS)[number]["id"];

function SignatureTypePanel({ onSignatureReady }: PanelProps) {
  const [text, setText] = useState("");
  const [fontId, setFontId] = useState<TypeFontId>("dancing");
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedFontCss =
    TYPE_FONTS.find((f) => f.id === fontId)?.css ?? "cursive";

  useEffect(() => {
    if (!text.trim()) {
      onSignatureReady(null);

      return;
    }

    let cancelled = false;

    const render = async () => {
      await document.fonts.ready;

      if (cancelled || !previewRef.current) return;

      const resolvedFont =
        getComputedStyle(previewRef.current).fontFamily || "cursive";

      const fontSize = 48;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      ctx.font = `${fontSize}px ${resolvedFont}`;
      const metrics = ctx.measureText(text);
      const padding = 16;

      canvas.width = Math.ceil(metrics.width) + padding * 2;
      canvas.height = fontSize + padding * 2;

      // Redraw after sizing
      ctx.font = `${fontSize}px ${resolvedFont}`;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "top";
      ctx.fillText(text, padding, padding);

      onSignatureReady(canvas.toDataURL("image/png"));
    };

    render();

    return () => {
      cancelled = true;
    };
    // `fontId` is a dep because `previewRef`'s computed font-family
    // changes when the user picks a different style \u2014 the canvas
    // needs to re-render with the new font.
  }, [text, fontId, onSignatureReady]);

  return (
    <div className="flex flex-col gap-3">
      <input
        className="w-full rounded-lg border border-default-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        placeholder="Type your signature"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div
        ref={previewRef}
        className="flex min-h-20 items-center justify-center rounded-lg border border-default-200 bg-white p-4"
        style={{ fontFamily: selectedFontCss, fontSize: "48px" }}
      >
        <span className="text-black">{text || "\u00A0"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TYPE_FONTS.map((f) => {
          const isActive = f.id === fontId;

          return (
            <button
              key={f.id}
              aria-pressed={isActive}
              className={`rounded-lg border px-3 py-1.5 text-[14px] transition-colors ${
                isActive
                  ? "border-[var(--color-primary,#f12c23)] bg-[var(--color-primary,#f12c23)]/5 text-[var(--color-primary,#f12c23)]"
                  : "border-default-200 text-default-700 hover:border-default-400"
              }`}
              style={{ fontFamily: f.css }}
              type="button"
              onClick={() => setFontId(f.id)}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Tab
// ---------------------------------------------------------------------------
function SignatureUploadPanel({ onSignatureReady }: PanelProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    (selected: File) => {
      setFile(selected);

      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          onSignatureReady(reader.result);
        }
      };
      reader.readAsDataURL(selected);
    },
    [onSignatureReady],
  );

  const handleFileClear = useCallback(() => {
    setFile(null);
    onSignatureReady(null);
  }, [onSignatureReady]);

  return (
    <FileUpload
      accept={["image/png", "image/jpeg", "image/svg+xml"]}
      acceptLabel="PNG, JPG, SVG"
      file={file}
      heading="Upload signature image"
      maxSize={5 * 1024 * 1024}
      onFileClear={handleFileClear}
      onFileSelect={handleFileSelect}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal Content (remounts on each open to reset state)
// ---------------------------------------------------------------------------
type PageScope = "current" | "all" | "custom";

function SignatureModalContent({
  fabricCanvas,
  onClose,
}: Omit<SignatureModalProps, "isOpen">) {
  const [activeTab, setActiveTab] = useState<string>("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [pageScope, setPageScope] = useState<PageScope>("current");
  const [customPagesRaw, setCustomPagesRaw] = useState("");

  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const totalPages = usePdfEditorStore((s) => s.pageOrder.length);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);

  const handleTabChange = useCallback((key: React.Key) => {
    setActiveTab(String(key));
    setSignatureDataUrl(null);
  }, []);

  // Preview of which pages will receive the signature — helps the
  // user catch typos in the custom-range input before clicking Add.
  const targetPages = useMemo<number[]>(() => {
    if (pageScope === "current") return [currentPage];
    if (pageScope === "all") {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const parsed = parsePageRange(customPagesRaw, totalPages);

    return parsed ?? [];
  }, [pageScope, currentPage, totalPages, customPagesRaw]);

  const handleConfirm = useCallback(async () => {
    if (!signatureDataUrl || !fabricCanvas) return;
    if (targetPages.length === 0) {
      toast.error({
        title: "No pages selected",
        description: "Enter at least one valid page number.",
      });

      return;
    }

    const { FabricImage } = await import("fabric");
    const img = await FabricImage.fromURL(signatureDataUrl);

    const maxWidth = 200;
    const scale = img.width && img.width > maxWidth ? maxWidth / img.width : 1;

    // Fabric JSON is stored in BASE coordinates (zoom = 1). The
    // canvas' `.width` / `.height` are the rendered (post-zoom) size.
    // Placement priority (QA 2026-10-03 row 2 reworked — signatures
    // were landing in a page CORNER on mobile taps and when the user
    // had scrolled so only a corner of the current page was visible):
    //   1. Last known pointer position on THIS page (`last-pointer.ts`),
    //      set by PdfViewerCanvas's mouse:move listener. Desktop users
    //      get the signature where they were hovering.
    //   2. Fallback: raw page centre. The prior visible-rect
    //      intersection fallback caused the "corner" bug — when only a
    //      corner slice of the page is in viewport, its midpoint IS
    //      near a page corner.
    // After resolving, we clamp the resolved center so the scaled image
    // bbox stays inside page bounds, so no part of the signature ends
    // up outside the page (the "partially cut off" variant).
    const zoom = fabricCanvas.getZoom() || 1;
    const pageW = (fabricCanvas.width ?? 600) / zoom;
    const pageH = (fabricCanvas.height ?? 800) / zoom;
    let centerX = pageW / 2;
    let centerY = pageH / 2;

    const lastPointer = getLastPointer();

    if (lastPointer && lastPointer.page === currentPage) {
      centerX = lastPointer.x;
      centerY = lastPointer.y;
    }

    const scaledW = (img.width ?? 0) * scale;
    const scaledH = (img.height ?? 0) * scale;
    const minX = scaledW / 2;
    const maxX = pageW - scaledW / 2;
    const minY = scaledH / 2;
    const maxY = pageH - scaledH / 2;

    // When signature is larger than the page in either axis the
    // clamp window collapses (min > max). Pin to the lower bound
    // (= stick to the top/left edge) so the user still sees it.
    centerX = maxX >= minX ? Math.min(Math.max(centerX, minX), maxX) : minX;
    centerY = maxY >= minY ? Math.min(Math.max(centerY, minY), maxY) : minY;

    img.set({
      left: centerX,
      lockUniScaling: true,
      originX: "center",
      originY: "center",
      scaleX: scale,
      scaleY: scale,
      top: centerY,
    });

    // QA 2026-10-03 row 3: stamp editorType BEFORE serializing /
    // adding so the live FabricImage instance carries the same
    // metadata as the JSON spliced into other pages. Previously only
    // the JSON copy had `editorType: "signature"` — the live `img`
    // had no editorType, which left same-session signatures
    // inconsistent with reloaded ones through
    // `stripBakedOverlaysForSave`, `applyPristineSweep`, and any
    // future editorType-aware filter.
    (img as unknown as { editorType?: string }).editorType = "signature";

    // Serialize the placed signature once — reused for every non-current
    // target page. The current page still gets the live FabricImage
    // instance so the user can drag/resize immediately.
    const signatureObjectJson = (
      img as unknown as {
        toObject: (extra?: string[]) => Record<string, unknown>;
      }
    ).toObject(["editorType"]);

    signatureObjectJson.editorType = "signature";

    const addToCurrentPage = targetPages.includes(currentPage);
    const otherPages = targetPages.filter((p) => p !== currentPage);

    if (addToCurrentPage) {
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
      // Persist the signature into the page map immediately so the next save
      // (including the auto-save before Version History) cannot miss it if the
      // generic dirty-flag listener fails to fire (reported 2026-07-23).
      saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
    }

    // For pages the live Fabric canvas isn't mounted on, splice the
    // signature straight into their stored fabricJsonByPage entry. When
    // the user navigates to any of those pages, the canvas mount effect
    // runs loadFromJSON and the signature appears at the same spot. We
    // reuse the current page's base dimensions — most PDFs are uniform,
    // and per-page dimensions live inside each JSON blob's width/height
    // fields already anyway, so if a different page has a different
    // size Fabric renders the signature at the same coords (worst case:
    // the user drags it into place).
    if (otherPages.length > 0) {
      const state = usePdfEditorStore.getState();

      for (const page of otherPages) {
        try {
          const existing = state.fabricJsonByPage.get(page);
          const canvasWidth =
            (fabricCanvas.width ?? 600) / (fabricCanvas.getZoom() || 1);
          const canvasHeight =
            (fabricCanvas.height ?? 800) / (fabricCanvas.getZoom() || 1);
          const parsed = existing
            ? (JSON.parse(existing) as {
                objects?: unknown[];
                width?: number;
                height?: number;
                [k: string]: unknown;
              })
            : {
                objects: [] as unknown[],
                width: canvasWidth,
                height: canvasHeight,
                version: "7.0.0",
              };

          const nextObjects = Array.isArray(parsed.objects)
            ? [...parsed.objects, signatureObjectJson]
            : [signatureObjectJson];

          const nextJson = JSON.stringify({
            ...parsed,
            objects: nextObjects,
            width: parsed.width ?? canvasWidth,
            height: parsed.height ?? canvasHeight,
          });

          state.pushHistory(page, nextJson);
          state.saveFabricJson(page, nextJson);
        } catch (err) {
          logger.captureError(err, "signature.multi_page_add_failed", {
            page,
          });
        }
      }
    }

    markDocumentDirty();

    if (otherPages.length > 0) {
      toast.success({
        title: "Signature added",
        description: `Placed on ${targetPages.length} page${targetPages.length === 1 ? "" : "s"}.`,
      });
    }

    onClose();
  }, [
    signatureDataUrl,
    fabricCanvas,
    currentPage,
    targetPages,
    pushHistory,
    saveFabricJson,
    markDocumentDirty,
    onClose,
  ]);

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Add Signature</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Signature method">
              <Tabs.Tab id="draw">
                Draw
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="type">
                <Tabs.Separator />
                Type
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="upload">
                <Tabs.Separator />
                Upload
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel className="pt-4" id="draw">
            <SignatureDrawPanel onSignatureReady={setSignatureDataUrl} />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="type">
            <SignatureTypePanel onSignatureReady={setSignatureDataUrl} />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="upload">
            <SignatureUploadPanel onSignatureReady={setSignatureDataUrl} />
          </Tabs.Panel>
        </Tabs>

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-2 border-t border-default-200 pt-4">
            <label className="text-sm font-medium text-default-700">
              Add to pages
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "current", label: `Current page (${currentPage})` },
                  { id: "all", label: `All pages (${totalPages})` },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map((opt) => {
                const isActive = pageScope === opt.id;

                return (
                  <button
                    key={opt.id}
                    aria-pressed={isActive}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? "border-[var(--color-primary,#f12c23)] bg-[var(--color-primary,#f12c23)]/5 text-[var(--color-primary,#f12c23)]"
                        : "border-default-200 text-default-700 hover:border-default-400"
                    }`}
                    type="button"
                    onClick={() => setPageScope(opt.id)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {pageScope === "custom" && (
              <div className="flex flex-col gap-1">
                <input
                  className="w-full rounded-lg border border-default-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  placeholder={`e.g. 1, 3, 5-${totalPages}`}
                  type="text"
                  value={customPagesRaw}
                  onChange={(e) => setCustomPagesRaw(e.target.value)}
                />
                <span className="text-xs text-default-500">
                  {targetPages.length > 0
                    ? `Signature will be added to ${targetPages.length} page${targetPages.length === 1 ? "" : "s"}: ${targetPages.slice(0, 8).join(", ")}${targetPages.length > 8 ? ", …" : ""}`
                    : "Enter page numbers or ranges separated by commas."}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="ghost">
          Cancel
        </Button>
        <Button
          isDisabled={!signatureDataUrl || targetPages.length === 0}
          onPress={handleConfirm}
        >
          Add Signature
          {targetPages.length > 1 ? ` (${targetPages.length} pages)` : ""}
        </Button>
      </Modal.Footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Signature Modal
// ---------------------------------------------------------------------------
export function SignatureModal({
  fabricCanvas,
  isOpen,
  onClose,
}: SignatureModalProps) {
  // Use a key to remount content on each open, resetting all internal state
  const [mountKey, setMountKey] = useState(0);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setMountKey((k) => k + 1);
      } else {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Modal.Container className="items-start justify-center p-4 sm:items-center">
          <Modal.Dialog className="max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain sm:max-w-[480px]">
            <Modal.CloseTrigger />
            <SignatureModalContent
              key={mountKey}
              fabricCanvas={fabricCanvas}
              onClose={onClose}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
