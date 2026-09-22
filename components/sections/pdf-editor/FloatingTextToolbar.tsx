"use client";

import type { Canvas, IText } from "fabric";

import {
  Cancel01Icon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  Label,
  ListBox,
  Select,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { usePdfEditorStore } from "@/lib/client/stores";

type TextAlign = "left" | "center" | "right";

type TextStyle = {
  color: string;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textAlign: TextAlign;
};

type FloatingTextToolbarProps = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  fabricCanvas: Canvas | null;
};

// Only fonts that map exactly to pdf-lib's built-in StandardFonts.
// pdf-lib has 14 StandardFonts (Adobe Type 1) — Helvetica, Times-Roman,
// Courier, and their bold/italic variants. Any font outside that set gets
// silently substituted by `resolveStandardFont` at render time:
//   Georgia → Times-Roman   (visible mismatch — distinct typefaces)
//   Verdana → Helvetica     (visible mismatch)
//   Trebuchet MS → Helvetica (visible mismatch)
//   Arial → Helvetica       (close but not exact)
// QA 2026-09-08: users picking Georgia / Verdana / Trebuchet MS / Arial in
// the composer saw the browser's real system font in the preview but got
// the substitute in the downloaded PDF. Pruning the list to only the three
// direct equivalents guarantees composer = download. Existing documents
// that still carry `fontFamily: "Georgia"` (etc.) in their Fabric JSON keep
// rendering through the same fallback path — nothing about the render
// pipeline changes. Only the picker options are restricted.
// Matches the Watermark toolbar's font list. To add more families later,
// bundle a real font file and embed it via `pdfDoc.embedFont(bytes)` in
// `FontCache` instead of the StandardFont branch.
const FONT_FAMILIES = ["Helvetica", "Times New Roman", "Courier New"];

// Standard font-size presets. Extracted text can have arbitrary sizes
// (e.g. 11.3, 13.7) — the current value is spliced into the list if
// missing so the Select shows the true current size.
const FONT_SIZE_PRESETS = [
  8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96,
];

// 10-swatch palette + free-form ColorPicker for anything else. Grid is
// 5 across × 2 tall — matches the visual weight of the other rows in
// the panel and keeps the panel narrow.
const COLOR_SWATCHES: readonly string[] = [
  "#000000",
  "#FFFFFF",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
  "#7C2D12",
] as const;

function normaliseTextAlign(value: string | undefined): TextAlign {
  if (value === "center" || value === "right") return value;

  return "left";
}

function getTextStyle(obj: IText): TextStyle {
  return {
    color: (obj.fill as string) ?? "#000000",
    fontFamily: obj.fontFamily ?? "Helvetica",
    fontSize: obj.fontSize ?? 16,
    isBold: obj.fontWeight === "bold",
    isItalic: obj.fontStyle === "italic",
    textAlign: normaliseTextAlign(obj.textAlign),
  };
}

export function FloatingTextToolbar({
  fabricCanvas,
}: FloatingTextToolbarProps) {
  const isMobile = useIsMobile();
  const activeTool = usePdfEditorStore((s) => s.activeTool);

  const DEFAULT_STYLE: TextStyle = {
    color: "#000000",
    fontFamily: "Helvetica",
    fontSize: 16,
    isBold: false,
    isItalic: false,
    textAlign: "left",
  };

  const [style, setStyle] = useState<TextStyle>(DEFAULT_STYLE);
  const activeObjRef = useRef<IText | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  // Tracks BottomDock's actual current height so this panel sits just
  // above it. A fixed `bottom-[70px]` matched the dock's own height
  // when only its tool row was showing, but the dock grows taller when
  // its page-thumbnail strip opens (BottomDock.tsx's `isThumbsOpen`) —
  // with a fixed offset, this panel stayed pinned at the old (shorter)
  // height and visibly overlapped the taller dock underneath it.
  const [dockOffset, setDockOffset] = useState(70);

  useLayoutEffect(() => {
    if (!isMobile) return;

    const dockEl = document.querySelector<HTMLElement>(
      '[aria-label="Editor dock"]',
    );

    if (!dockEl) return;

    const GAP = 12; // matches the panel's original ~12px separation from the dock

    const update = () =>
      setDockOffset(dockEl.getBoundingClientRect().height + GAP);

    update();

    const observer = new ResizeObserver(update);

    observer.observe(dockEl);

    return () => observer.disconnect();
  }, [isMobile]);

  // Observability logs for touch behaviour on the mobile toolbar. The
  // real "page above swipes when I swipe the toolbar" bug was in
  // `PdfViewerCanvas`'s document-scoped page-nav handler firing on
  // touches outside the viewer (fixed 2026-08-26 with a
  // `touchStartedInsideViewer` guard). Keeping the logs for now so any
  // future regressions surface quickly on-device.
  useEffect(() => {
    if (!isMobile) return;
    const el = rootRef.current;

    if (!el) return;
    let startX = 0;
    let startY = 0;
    let insideScroller = false;

    const onStart = (event: TouchEvent) => {
      const t = event.touches[0];

      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      const target = event.target as HTMLElement | null;

      insideScroller = Boolean(target?.closest?.("[data-touch-scroll-x]"));
      // eslint-disable-next-line no-console
      console.log("[PDFedits] text-toolbar touchstart", {
        x: Math.round(startX),
        y: Math.round(startY),
        insideScroller,
        target: target?.tagName,
      });
    };

    const onMove = (event: TouchEvent) => {
      const t = event.touches[0];

      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const isHorizontal = Math.abs(dx) > Math.abs(dy);

      // eslint-disable-next-line no-console
      console.log("[PDFedits] text-toolbar touchmove", {
        dx: Math.round(dx),
        dy: Math.round(dy),
        isHorizontal,
        insideScroller,
      });
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, [isMobile]);

  // Show when editText tool is active OR when a text object is selected.
  const isEditTextMode = activeTool === "editText";
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const visible = isEditTextMode || hasTextSelection;

  // Reset to defaults when leaving editText mode so the panel starts
  // fresh next time the tool is activated. State reset uses React's
  // "adjust state during render" pattern (react-hooks/set-state-in-effect
  // flags the effect variant); the ref reset stays in an effect because
  // ref mutations aren't allowed during render.
  const [prevEditTextMode, setPrevEditTextMode] = useState(isEditTextMode);

  if (prevEditTextMode !== isEditTextMode) {
    setPrevEditTextMode(isEditTextMode);
    if (!isEditTextMode) {
      setHasTextSelection(false);
      setStyle(DEFAULT_STYLE);
    }
  }

  useEffect(() => {
    if (!isEditTextMode) activeObjRef.current = null;
  }, [isEditTextMode]);

  useEffect(() => {
    if (!fabricCanvas) return;

    const showToolbar = () => {
      const obj = fabricCanvas.getActiveObject();

      // Fabric's Textbox reports type "textbox"; IText reports "i-text";
      // extracted source text (created by useEditTextMode) is Textbox.
      // Match both so the panel opens for annotations, signatures, page
      // numbers, and extracted text.
      const isTextTarget =
        !!obj && (obj.type === "i-text" || obj.type === "textbox");

      if (!isTextTarget) {
        setHasTextSelection(false);
        activeObjRef.current = null;

        return;
      }

      const textObj = obj as IText;

      activeObjRef.current = textObj;
      setStyle(getTextStyle(textObj));
      setHasTextSelection(true);
    };

    const hideToolbar = () => {
      setHasTextSelection(false);
      activeObjRef.current = null;
    };

    fabricCanvas.on("selection:created", showToolbar);
    fabricCanvas.on("selection:updated", showToolbar);
    fabricCanvas.on("selection:cleared", hideToolbar);

    return () => {
      fabricCanvas.off("selection:created", showToolbar);
      fabricCanvas.off("selection:updated", showToolbar);
      fabricCanvas.off("selection:cleared", hideToolbar);
    };
  }, [fabricCanvas]);

  const applyStyle = (patch: Partial<TextStyle>) => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    const next = { ...style, ...patch };

    setStyle(next);

    const fabricPatch: Record<string, unknown> = {
      fill: next.color,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fontStyle: next.isItalic ? "italic" : "normal",
      fontWeight: next.isBold ? "bold" : "normal",
      textAlign: next.textAlign,
    };

    // IText supports per-character styles which silently override
    // object-level set() — apply to selection range when actively editing,
    // and clear stale per-char fills/fonts otherwise so the change sticks.
    const iText = obj as IText & {
      isEditing?: boolean;
      selectionEnd?: number;
      selectionStart?: number;
      setSelectionStyles?: (styles: Record<string, unknown>) => void;
      styles?: Record<string, Record<string, Record<string, unknown>>>;
    };
    const hasRangeSelection =
      iText.isEditing === true &&
      typeof iText.selectionStart === "number" &&
      typeof iText.selectionEnd === "number" &&
      iText.selectionStart !== iText.selectionEnd &&
      typeof iText.setSelectionStyles === "function";

    if (hasRangeSelection) {
      // Per-character props (fill / fontFamily / fontSize / fontStyle /
      // fontWeight) only. textAlign is a paragraph-level prop, so apply
      // it on the object regardless.
      const { textAlign: _textAlign, ...perChar } = fabricPatch;

      iText.setSelectionStyles!(perChar);
      // Also mirror onto the object-level. Fabric's canvas paint order
      // is per-character > object-level, so the editor still shows
      // exactly what the user selected. But the export merge drawer
      // (`drawIText`) reads ONLY the object-level fontFamily /
      // fontSize / fontWeight / fontStyle / fill — without this
      // mirror, a range-selection font change would show correctly in
      // the editor and then fall back to whatever the object was
      // created with (Helvetica / 16) in the downloaded PDF (QA
      // 2026-09-08: "font and/or font size differs from Composer").
      obj.set(fabricPatch);
    } else {
      obj.set(fabricPatch);

      // Strip any per-character entries for the keys we just changed.
      if (iText.styles) {
        const keys = Object.keys(fabricPatch);

        for (const line of Object.values(iText.styles)) {
          for (const charStyle of Object.values(line)) {
            const css = charStyle as Record<string, unknown>;

            for (const k of keys) {
              delete css[k];
            }
          }
        }
      }
    }

    // Invalidate Fabric's object cache + re-run Textbox layout so paint
    // reflects the new styles. Without this, changes like `textAlign`
    // (paragraph-level, requires re-layout to reposition each line) and
    // `fontSize` (Textbox needs `initDimensions` to recompute its wrapped
    // lines) can appear unchanged in the editor even though the object's
    // properties updated. Fabric's default `objectCaching: true` on
    // Textbox / IText caches the painted bitmap; setting `dirty = true`
    // forces the next `renderAll` to redraw from scratch. QA 2026-09-08:
    // "text alignment (Left/Center/Right) buttons have no visible effect
    // in Composer."
    const dirtyObj = obj as {
      dirty?: boolean;
      initDimensions?: () => void;
      setCoords?: () => void;
    };

    dirtyObj.dirty = true;
    try {
      dirtyObj.initDimensions?.();
    } catch {
      // initDimensions can throw during a mid-edit style change on some
      // Fabric versions — the subsequent renderAll still repaints.
    }
    dirtyObj.setCoords?.();
    fabricCanvas.requestRenderAll();

    // QA 2026-09-09: font-family (and size/bold/italic/color/alignment) picks
    // in this toolbar showed correctly in the composer but were silently
    // dropped on save/download. Root cause: `obj.set(fabricPatch)` is a pure
    // Fabric setter — it does NOT emit `object:modified`. The extracted
    // source-text pipeline in `use-editor-history.ts` relies on that event to
    // flip `editModeText.pristine → false`, which is what
    // `merge-pdf.ts:isModifiedEditModeText` reads to decide whether the page
    // needs the modified-editModeText branch (whiteout + vector `drawIText`
    // with the user's chosen font) vs. copying the source page byte-for-byte
    // (which preserves the ORIGINAL embedded font, not our override).
    //
    // Firing the event here also runs `snapshot` (pushes history +
    // serializes to `fabricJsonByPage` so the change survives reload) and
    // `markDirtyOnEdit` (flips `hasUnsavedChanges` so the save button /
    // reload guard know there's work to persist). All three listeners
    // early-return for irrelevant cases (`isCreatingShape /
    // isRestoringHistory` guards; `dirtySourceText` short-circuits on
    // non-editModeText objects), so non-extracted text overlays
    // (annotations, signatures, page numbers, watermark, text tool) are
    // unaffected — this only "unlocks" export-fidelity for extracted PDF
    // text, which is exactly the surface QA reported.
    fabricCanvas.fire("object:modified", { target: obj });
  };

  const close = () => {
    usePdfEditorStore.getState().setActiveTool("select");
    if (fabricCanvas) {
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
    }
  };

  if (!visible) return null;

  const textStyleKeys = new Set<string>();

  if (style.isBold) textStyleKeys.add("bold");
  if (style.isItalic) textStyleKeys.add("italic");

  // Font-size preset list, with the current value spliced in front when
  // it isn't a preset (pdf.js often extracts sizes like 11.3 or 13.7).
  const currentSize = Math.round(style.fontSize * 10) / 10;
  const sizeItems = FONT_SIZE_PRESETS.some(
    (s) => Math.round(s * 10) === Math.round(currentSize * 10),
  )
    ? FONT_SIZE_PRESETS
    : [currentSize, ...FONT_SIZE_PRESETS];
  const selectedSizeKey = String(currentSize);

  return (
    // `touch-none` on the mobile outer aside so any touch on padding,
    // gaps, or the close button is consumed with no scroll effect. The
    // inner horizontal scroll row below re-enables `touch-pan-x` for
    // itself so users can still swipe the FONT/SIZE/STYLE/ALIGNMENT
    // strip horizontally. Prior `touch-pan-x` on the inner strip alone
    // wasn't enough — touches on the aside's `pt-2 pb-3 px-4` padding
    // still leaked to the PDF viewer above. Desktop keeps default
    // touch-action since it's a floating right-side panel that doesn't
    // sit atop the PDF viewer's scroll area.
    <aside
      ref={rootRef}
      aria-label="Text formatting"
      className={
        isMobile
          ? // `bottom` comes from the `dockOffset` state (see above) —
            // it tracks the dock's actual height instead of a fixed value.
            "pointer-events-auto fixed inset-x-0 z-50 flex touch-none flex-col gap-2 border-t border-default-200 bg-white px-4 pb-3 pt-2 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]"
          : "pointer-events-auto fixed right-4 top-1/2 z-50 flex w-[188px] -translate-y-1/2 flex-col gap-4 rounded-2xl border border-default-200 bg-white p-4 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
      }
      style={isMobile ? { bottom: dockOffset } : undefined}
      // `data-editor-overlay` opts this out of `PdfViewerCanvas`'s
      // document-scoped swipe-to-flip page-nav handler. Without it,
      // horizontal swipes on the FONT/SIZE/STYLE strip flipped pages
      // because this toolbar is DOM-nested inside `viewerScrollRef`.
      data-editor-overlay=""
      role="region"
    >
      {/* Close button */}
      <button
        aria-label="Close text formatting"
        className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-default-700"
        type="button"
        onClick={close}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={16} />
      </button>
      {/* On mobile: horizontal scrollable row; on desktop: vertical column.
          `touch-pan-x` on the mobile branch confines touch gestures to
          horizontal panning — without it, a vertical drag started on this
          strip has no gesture handler and the browser walks up the DOM
          and pans the PDF viewer above (same fix as the BottomDock strip,
          QA report 2026-08-26). */}
      <div
        className={
          isMobile
            ? // `pb-2`: `overflow-x-auto` also clips the Y axis per the CSS
              // overflow spec (a non-`visible` x paired with `visible` y
              // computes both to `auto`). The Font/Size `Select.Trigger`s'
              // box-shadow reaches exactly to this row's own bottom edge,
              // so without this the shadow's blur was clipped off flush —
              // Bold/Align's borderless `ToggleButton`s have no shadow, so
              // they never showed the same cut.
              "flex touch-pan-x items-start gap-4 overflow-x-auto pb-2 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex flex-col gap-4"
        }
        data-touch-scroll-x={isMobile ? "" : undefined}
      >
        {/* Font family */}
        <div className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
            Font
          </span>
          <Select
            aria-label="Font family"
            className="w-full"
            selectedKey={style.fontFamily}
            onSelectionChange={(key) => applyStyle({ fontFamily: String(key) })}
          >
            <Select.Trigger className="rounded-3xl border-0 bg-default shadow-none">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {FONT_FAMILIES.map((f) => (
                  <ListBox.Item key={f} id={f} textValue={f}>
                    {f}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* Font size */}
        <div className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
            Size
          </span>
          <Select
            aria-label="Font size"
            className="w-full"
            selectedKey={selectedSizeKey}
            onSelectionChange={(key) => {
              const next = Number(key);

              if (!Number.isFinite(next) || next <= 0) return;
              applyStyle({ fontSize: next });
            }}
          >
            <Select.Trigger className="rounded-3xl border-0 bg-default shadow-none">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {sizeItems.map((s) => {
                  const key = String(s);

                  return (
                    <ListBox.Item key={key} id={key} textValue={key}>
                      {s}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* Bold + Italic */}
        <div className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
            Style
          </span>
          <ToggleButtonGroup
            aria-label="Text style"
            selectedKeys={textStyleKeys}
            selectionMode="multiple"
            size="sm"
            onSelectionChange={(keys) => {
              const set = keys as Set<string>;

              applyStyle({
                isBold: set.has("bold"),
                isItalic: set.has("italic"),
              });
            }}
          >
            <ToggleButton isIconOnly aria-label="Bold" id="bold">
              <HugeiconsIcon icon={TextBoldIcon} size={16} />
            </ToggleButton>
            <ToggleButton isIconOnly aria-label="Italic" id="italic">
              <HugeiconsIcon icon={TextItalicIcon} size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {/* Alignment */}
        <div className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
            Alignment
          </span>
          <ToggleButtonGroup
            aria-label="Text alignment"
            selectedKeys={new Set([style.textAlign])}
            selectionMode="single"
            size="sm"
            onSelectionChange={(keys) => {
              const set = keys as Set<string>;
              const next = set.values().next().value;

              if (next === "left" || next === "center" || next === "right") {
                applyStyle({ textAlign: next });
              }
            }}
          >
            <ToggleButton isIconOnly aria-label="Align left" id="left">
              <HugeiconsIcon icon={TextAlignLeftIcon} size={16} />
            </ToggleButton>
            <ToggleButton isIconOnly aria-label="Align center" id="center">
              <HugeiconsIcon icon={TextAlignCenterIcon} size={16} />
            </ToggleButton>
            <ToggleButton isIconOnly aria-label="Align right" id="right">
              <HugeiconsIcon icon={TextAlignRightIcon} size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {/* Color palette + custom picker */}
        <div className="flex shrink-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
            Color
          </span>
          <div
            className={
              isMobile
                ? "flex flex-nowrap items-center gap-1.5"
                : "grid grid-cols-5 gap-1.5"
            }
          >
            {COLOR_SWATCHES.map((hex) => {
              const isActive = style.color.toLowerCase() === hex.toLowerCase();

              return (
                <button
                  key={hex}
                  aria-label={`Set color ${hex}`}
                  aria-pressed={isActive}
                  className={`h-7 w-7 shrink-0 cursor-pointer rounded-md border transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isActive
                      ? "border-primary shadow-[0_0_0_2px_var(--heroui-primary-200)]"
                      : "border-default-200"
                  }`}
                  style={{ backgroundColor: hex }}
                  type="button"
                  onClick={() => applyStyle({ color: hex })}
                />
              );
            })}
            <ColorPicker
              value={style.color}
              onChange={(color) => applyStyle({ color: color.toString("hex") })}
            >
              <ColorPicker.Trigger>
                <button
                  aria-label="More colors"
                  className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-default-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                  }}
                  type="button"
                />
                <Label className="sr-only">More colors</Label>
              </ColorPicker.Trigger>
              <ColorPicker.Popover>
                <ColorArea
                  aria-label="Color area"
                  className="max-w-full"
                  colorSpace="hsb"
                  xChannel="saturation"
                  yChannel="brightness"
                >
                  <ColorArea.Thumb />
                </ColorArea>
                <ColorSlider
                  channel="hue"
                  className="gap-1 px-1"
                  colorSpace="hsb"
                >
                  <ColorSlider.Track>
                    <ColorSlider.Thumb />
                  </ColorSlider.Track>
                </ColorSlider>
              </ColorPicker.Popover>
            </ColorPicker>
          </div>
        </div>
      </div>
    </aside>
  );
}
